require('dotenv').config();
const http = require('http');
const app = require('./app');
const { pool } = require('./db');

/**
 * Creates an idempotent, graceful shutdown handler for the HTTP server and DB pool.
 *
 * Requirements enforced:
 * - Stops accepting new HTTP connections via server.close().
 * - Allows active requests a bounded opportunity to complete.
 * - Closes and drains PostgreSQL pool.
 * - Handles repeated/concurrent shutdown signals safely.
 * - Exits with status 1 if cleanup fails or times out; status 0 on clean completion.
 * - Avoids calling process.exit before cleanup finishes.
 */
function createShutdownHandler({
  server,
  pool: dbPool = pool,
  shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000,
  logger = console,
  exitProcess = true,
} = {}) {
  let isShuttingDown = false;

  return async function shutdown(signal = 'SIGTERM') {
    if (isShuttingDown) {
      if (typeof logger.warn === 'function') {
        logger.warn(`[server] Shutdown already in progress. Ignoring duplicate signal (${signal}).`);
      }
      return;
    }
    isShuttingDown = true;
    if (typeof logger.log === 'function') {
      logger.log(`[server] Received ${signal}. Starting graceful shutdown...`);
    }

    let forceExitTimer = null;
    if (exitProcess) {
      forceExitTimer = setTimeout(() => {
        if (typeof logger.error === 'function') {
          logger.error(`[server] Graceful shutdown timed out after ${shutdownTimeoutMs}ms. Forcing exit.`);
        }
        process.exit(1);
      }, shutdownTimeoutMs);
      if (forceExitTimer.unref) forceExitTimer.unref();
    }

    try {
      // 1. Stop accepting new HTTP requests and close idle keep-alive connections
      await new Promise((resolve, reject) => {
        if (!server || !server.listening) {
          return resolve();
        }
        server.close((err) => {
          if (err) return reject(err);
          resolve();
        });
        if (typeof server.closeIdleConnections === 'function') {
          server.closeIdleConnections();
        }
      });
      if (typeof logger.log === 'function') {
        logger.log('[server] Closed HTTP server; stopped accepting new connections.');
      }

      // 2. Drain and close database pool
      if (dbPool && typeof dbPool.end === 'function') {
        await dbPool.end();
        if (typeof logger.log === 'function') {
          logger.log('[server] Database pool drained and closed.');
        }
      }

      if (forceExitTimer) clearTimeout(forceExitTimer);
      if (typeof logger.log === 'function') {
        logger.log('[server] Graceful shutdown completed cleanly.');
      }

      if (exitProcess) {
        process.exit(0);
      }
    } catch (err) {
      if (forceExitTimer) clearTimeout(forceExitTimer);
      if (typeof logger.error === 'function') {
        logger.error('[server] Error during graceful shutdown:', err?.message || err);
      }
      if (exitProcess) {
        process.exit(1);
      }
      throw err;
    }
  };
}

/**
 * Start the HTTP server.
 * Returns an object containing the server instance and the shutdown function.
 */
function startServer(port = process.env.PORT || 3000, options = {}) {
  const server = http.createServer(app);

  const shutdown = createShutdownHandler({
    server,
    pool,
    shutdownTimeoutMs: options.shutdownTimeoutMs,
    logger: options.logger || console,
    exitProcess: options.exitProcess !== undefined ? options.exitProcess : true,
  });

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`SAATHI API listening on :${port}`);
  });

  return { server, shutdown };
}

// Auto-start and register signal listeners ONLY when executed directly as main script
// Do not register signal handlers merely by importing the server module in tests.
if (require.main === module) {
  const port = process.env.PORT || 3000;
  const { shutdown } = startServer(port);

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
}

module.exports = {
  startServer,
  createShutdownHandler,
};
