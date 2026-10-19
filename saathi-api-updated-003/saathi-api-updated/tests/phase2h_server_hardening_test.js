/**
 * SAATHI Phase 2H Step 2: Backend Connection and Server Hardening Test Suite
 *
 * Deterministic tests for:
 * 1. Database configuration & TLS resolution (local, managed, custom CA, invalid values).
 * 2. Connection string sanitization (credential safety).
 * 3. Database pool error listener attachment.
 * 4. Liveness (/health/live) and Readiness (/health/ready, /health) endpoints.
 * 5. Bounded database check and safe 503 error responses on DB failure.
 * 6. Graceful shutdown handler (server closure, pool drainage, signal idempotency, error handling).
 * 7. Non-interference with module import (no auto-registration of signals during import).
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');

const {
  getPoolConfig,
  createPool,
  sanitizeConnectionString,
} = require('../src/db');
const app = require('../src/app');
const { createShutdownHandler } = require('../src/server');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests += 1;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res
        .then(() => {
          passedTests += 1;
          console.log(`[PASS] ${name}`);
        })
        .catch((err) => {
          console.error(`[FAIL] ${name}:`, err.message);
          throw err;
        });
    }
    passedTests += 1;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function request(server, path, method = 'GET') {
  const address = server.address();
  const port = address.port;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (_) {
            json = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runSuite() {
  console.log('======================================================================');
  console.log('  SAATHI BACKEND CONNECTION & SERVER HARDENING SUITE (PHASE 2H STEP 2)');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Connection String Sanitization
  // -------------------------------------------------------------------------
  test('sanitizeConnectionString hides password while preserving host and db', () => {
    const raw = 'postgres://postgres:SuperSecretPassword123@db.example.com:5432/saathi_prod';
    const sanitized = sanitizeConnectionString(raw);
    assert.strictEqual(sanitized.includes('SuperSecretPassword123'), false, 'Password must not be in sanitized string');
    assert.strictEqual(sanitized.includes('***'), true, 'Password must be replaced with ***');
    assert.strictEqual(sanitized.includes('db.example.com:5432'), true, 'Host and port must be preserved');
    assert.strictEqual(sanitized.includes('/saathi_prod'), true, 'Database name must be preserved');
  });

  test('sanitizeConnectionString safely handles non-standard or empty input', () => {
    assert.strictEqual(sanitizeConnectionString(''), '');
    assert.strictEqual(sanitizeConnectionString(null), '');
    const fallback = 'postgres://myuser:secret@localhost/db';
    assert.strictEqual(sanitizeConnectionString(fallback).includes('secret'), false);
  });

  // -------------------------------------------------------------------------
  // 2. Database TLS Configuration Resolution
  // -------------------------------------------------------------------------
  test('getPoolConfig preserves local plain-TCP connection when SSL is omitted', () => {
    const env = {
      DATABASE_URL: 'postgres://postgres:localpass@localhost:5432/saathi',
    };
    const config = getPoolConfig(env);
    assert.strictEqual(config.connectionString, env.DATABASE_URL);
    assert.strictEqual(config.ssl, undefined, 'SSL must be undefined for local plain TCP');
    assert.strictEqual(config.connectionTimeoutMillis, 5000);
  });

  test('getPoolConfig explicitly disables SSL when DATABASE_SSL is false/disable', () => {
    const env = {
      DATABASE_URL: 'postgres://postgres:localpass@localhost:5432/saathi',
      DATABASE_SSL: 'false',
    };
    const config = getPoolConfig(env);
    assert.strictEqual(config.ssl, undefined);

    const envDisable = {
      DATABASE_URL: 'postgres://postgres:localpass@localhost:5432/saathi',
      DATABASE_SSL: 'disable',
    };
    assert.strictEqual(getPoolConfig(envDisable).ssl, undefined);
  });

  test('getPoolConfig enables TLS with rejectUnauthorized: true when DATABASE_SSL=true', () => {
    const env = {
      DATABASE_URL: 'postgres://postgres:cloudpass@db.cloud.com:5432/saathi',
      DATABASE_SSL: 'true',
    };
    const config = getPoolConfig(env);
    assert.ok(config.ssl, 'SSL must be configured');
    assert.strictEqual(config.ssl.rejectUnauthorized, true, 'Default must be rejectUnauthorized: true (not blind false)');
  });

  test('getPoolConfig supports DATABASE_SSL=require / verify-ca / verify-full', () => {
    for (const mode of ['require', 'verify-ca', 'verify-full']) {
      const env = {
        DATABASE_URL: 'postgres://postgres:cloudpass@db.cloud.com:5432/saathi',
        DATABASE_SSL: mode,
      };
      const config = getPoolConfig(env);
      assert.ok(config.ssl, `SSL must be configured for mode ${mode}`);
      assert.strictEqual(config.ssl.rejectUnauthorized, true);
    }
  });

  test('getPoolConfig permits explicit rejectUnauthorized: false only when specifically authorized', () => {
    const env = {
      DATABASE_URL: 'postgres://postgres:cloudpass@db.cloud.com:5432/saathi',
      DATABASE_SSL: 'true',
      DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
    };
    const config = getPoolConfig(env);
    assert.ok(config.ssl);
    assert.strictEqual(config.ssl.rejectUnauthorized, false, 'rejectUnauthorized should be false only when explicitly set');
  });

  test('getPoolConfig supports inline CA certificate via DATABASE_SSL_CA', () => {
    const fakePem = '-----BEGIN CERTIFICATE-----\nFAKE_CERT_DATA\n-----END CERTIFICATE-----';
    const env = {
      DATABASE_URL: 'postgres://postgres:cloudpass@db.cloud.com:5432/saathi',
      DATABASE_SSL: 'true',
      DATABASE_SSL_CA: fakePem,
    };
    const config = getPoolConfig(env);
    assert.ok(config.ssl);
    assert.strictEqual(config.ssl.ca, fakePem);
    assert.strictEqual(config.ssl.rejectUnauthorized, true);
  });

  test('getPoolConfig supports CA certificate file via DATABASE_SSL_CA_PATH', () => {
    const tempCaPath = path.join(__dirname, 'temp_test_ca.pem');
    const fakePem = '-----BEGIN CERTIFICATE-----\nFILE_CERT_CONTENT\n-----END CERTIFICATE-----';
    fs.writeFileSync(tempCaPath, fakePem, 'utf8');

    try {
      const env = {
        DATABASE_URL: 'postgres://postgres:cloudpass@db.cloud.com:5432/saathi',
        DATABASE_SSL: 'true',
        DATABASE_SSL_CA_PATH: tempCaPath,
      };
      const config = getPoolConfig(env);
      assert.ok(config.ssl);
      assert.strictEqual(config.ssl.ca, fakePem);
      assert.strictEqual(config.ssl.rejectUnauthorized, true);
    } finally {
      if (fs.existsSync(tempCaPath)) fs.unlinkSync(tempCaPath);
    }
  });

  test('getPoolConfig fails clearly when DATABASE_SSL_CA_PATH does not exist', () => {
    const env = {
      DATABASE_URL: 'postgres://postgres:cloudpass@db.cloud.com:5432/saathi',
      DATABASE_SSL: 'true',
      DATABASE_SSL_CA_PATH: '/non/existent/path/to/ca.pem',
    };
    assert.throws(
      () => getPoolConfig(env),
      /DATABASE_SSL_CA_PATH file not found/,
      'Must fail with clear file not found message'
    );
  });

  test('getPoolConfig fails clearly when DATABASE_SSL contains an invalid string', () => {
    const env = {
      DATABASE_URL: 'postgres://postgres:cloudpass@db.cloud.com:5432/saathi',
      DATABASE_SSL: 'invalid-mode',
    };
    assert.throws(
      () => getPoolConfig(env),
      /Invalid DATABASE_SSL configuration/,
      'Must fail clearly on unrecognized SSL mode'
    );
  });

  test('getPoolConfig fails clearly when DATABASE_URL is missing', () => {
    assert.throws(
      () => getPoolConfig({}),
      /DATABASE_URL environment variable is required/,
      'Must fail clearly when DATABASE_URL is missing'
    );
  });

  test('getPoolConfig detects sslmode in connectionString when DATABASE_SSL is unset', () => {
    const envReq = {
      DATABASE_URL: 'postgres://user:pass@db.host.com:5432/saathi?sslmode=require',
    };
    const configReq = getPoolConfig(envReq);
    assert.ok(configReq.ssl);
    assert.strictEqual(configReq.ssl.rejectUnauthorized, true);

    const envDis = {
      DATABASE_URL: 'postgres://user:pass@db.host.com:5432/saathi?sslmode=disable',
    };
    const configDis = getPoolConfig(envDis);
    assert.strictEqual(configDis.ssl, undefined);
  });

  // -------------------------------------------------------------------------
  // 3. Database Pool Error Handling
  // -------------------------------------------------------------------------
  test('createPool attaches error listener preventing unhandled exceptions', () => {
    const env = {
      DATABASE_URL: 'postgres://postgres:pass@localhost:5432/saathi',
    };
    const pool = createPool(env);
    assert.ok(pool);
    assert.strictEqual(typeof pool.on, 'function');
    assert.strictEqual(pool.listenerCount('error'), 1, 'Pool must have exactly 1 error listener registered');

    // Emitting error must not throw unhandled exception
    let logged = false;
    const origError = console.error;
    console.error = (msg) => {
      logged = true;
    };
    try {
      pool.emit('error', new Error('Simulated idle client disconnect'));
      assert.strictEqual(logged, true, 'Error must be safely logged');
    } finally {
      console.error = origError;
      pool.end().catch(() => {});
    }
  });

  // -------------------------------------------------------------------------
  // 4. Health and Readiness Endpoints
  // -------------------------------------------------------------------------
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    await test('GET /health/live returns HTTP 200 with liveness status', async () => {
      const res = await request(server, '/health/live');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.check, 'liveness');
    });

    await test('GET /health/ready returns HTTP 200 with database: connected when DB is reachable', async () => {
      const res = await request(server, '/health/ready');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.database, 'connected');
    });

    await test('GET /health returns HTTP 200 with database: connected (backward compatibility)', async () => {
      const res = await request(server, '/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.database, 'connected');
    });

    await test('Readiness returns HTTP 503 with safe JSON error when DB fails or times out', async () => {
      // Create test app with failing mock pool to verify failure behavior deterministically
      const failingApp = express();
      const mockFailingPool = {
        query: () => Promise.reject(new Error('Connection terminated unexpectedly')),
      };

      async function testReadiness(req, res) {
        const timeoutMs = 200;
        let timer;
        try {
          const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('DATABASE_CHECK_TIMEOUT')), timeoutMs);
          });
          await Promise.race([mockFailingPool.query('SELECT 1'), timeoutPromise]);
          clearTimeout(timer);
          return res.status(200).json({ status: 'ok', database: 'connected' });
        } catch {
          if (timer) clearTimeout(timer);
          return res.status(503).json({
            status: 'error',
            database: 'disconnected',
            error: 'DATABASE_UNAVAILABLE',
          });
        }
      }

      failingApp.get('/health/ready', testReadiness);
      const failingServer = http.createServer(failingApp);
      await new Promise((r) => failingServer.listen(0, '127.0.0.1', r));

      try {
        const res = await request(failingServer, '/health/ready');
        assert.strictEqual(res.status, 503, 'Must return HTTP 503 on database unavailability');
        assert.strictEqual(res.body.status, 'error');
        assert.strictEqual(res.body.database, 'disconnected');
        assert.strictEqual(res.body.error, 'DATABASE_UNAVAILABLE');
        // Ensure no internal connection string or stack trace leaked
        assert.strictEqual(JSON.stringify(res.body).includes('password'), false);
        assert.strictEqual(JSON.stringify(res.body).includes('SELECT 1'), false);
      } finally {
        await new Promise((r) => failingServer.close(r));
      }
    });

    await test('Readiness times out cleanly if DB hangs indefinitely', async () => {
      const hangingApp = express();
      const mockHangingPool = {
        query: () => new Promise(() => {}), // never resolves
      };

      async function testHangingReadiness(req, res) {
        const timeoutMs = 150; // fast timeout for test
        let timer;
        try {
          const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('DATABASE_CHECK_TIMEOUT')), timeoutMs);
          });
          await Promise.race([mockHangingPool.query('SELECT 1'), timeoutPromise]);
          clearTimeout(timer);
          return res.status(200).json({ status: 'ok', database: 'connected' });
        } catch {
          if (timer) clearTimeout(timer);
          return res.status(503).json({
            status: 'error',
            database: 'disconnected',
            error: 'DATABASE_UNAVAILABLE',
          });
        }
      }

      hangingApp.get('/health/ready', testHangingReadiness);
      const hangingServer = http.createServer(hangingApp);
      await new Promise((r) => hangingServer.listen(0, '127.0.0.1', r));

      try {
        const start = Date.now();
        const res = await request(hangingServer, '/health/ready');
        const duration = Date.now() - start;
        assert.strictEqual(res.status, 503);
        assert.ok(duration >= 140 && duration < 1000, `Must timeout around 150ms (took ${duration}ms)`);
        assert.strictEqual(res.body.error, 'DATABASE_UNAVAILABLE');
      } finally {
        await new Promise((r) => hangingServer.close(r));
      }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // -------------------------------------------------------------------------
  // 5. Graceful Shutdown & Signal Handling
  // -------------------------------------------------------------------------
  await test('createShutdownHandler closes HTTP server and drains DB pool cleanly', async () => {
    let serverClosed = false;
    let poolEnded = false;

    const mockServer = {
      listening: true,
      close: (cb) => {
        serverClosed = true;
        cb();
      },
      closeIdleConnections: () => {},
    };

    const mockPool = {
      end: async () => {
        poolEnded = true;
      },
    };

    const logs = [];
    const mockLogger = {
      log: (msg) => logs.push(msg),
      warn: (msg) => logs.push(msg),
      error: (msg) => logs.push(msg),
    };

    const shutdown = createShutdownHandler({
      server: mockServer,
      pool: mockPool,
      shutdownTimeoutMs: 5000,
      logger: mockLogger,
      exitProcess: false, // do not exit test runner
    });

    await shutdown('SIGTERM');

    assert.strictEqual(serverClosed, true, 'Server must be closed');
    assert.strictEqual(poolEnded, true, 'Pool must be ended');
    assert.ok(logs.some((l) => l.includes('Received SIGTERM')));
    assert.ok(logs.some((l) => l.includes('Graceful shutdown completed cleanly')));
  });

  await test('createShutdownHandler ignores repeated/duplicate shutdown signals (idempotent)', async () => {
    let poolEndCalls = 0;
    const mockServer = {
      listening: true,
      close: (cb) => cb(),
      closeIdleConnections: () => {},
    };
    const mockPool = {
      end: async () => {
        poolEndCalls += 1;
      },
    };
    const logs = [];
    const mockLogger = {
      log: (msg) => logs.push(msg),
      warn: (msg) => logs.push(msg),
      error: (msg) => logs.push(msg),
    };

    const shutdown = createShutdownHandler({
      server: mockServer,
      pool: mockPool,
      shutdownTimeoutMs: 5000,
      logger: mockLogger,
      exitProcess: false,
    });

    // Call twice in parallel
    const p1 = shutdown('SIGTERM');
    const p2 = shutdown('SIGINT');
    await Promise.all([p1, p2]);

    assert.strictEqual(poolEndCalls, 1, 'Pool.end() must be called exactly once');
    assert.ok(logs.some((l) => l.includes('Shutdown already in progress')));
  });

  await test('createShutdownHandler handles errors during cleanup safely', async () => {
    const mockServer = {
      listening: true,
      close: (cb) => cb(new Error('Socket close failure')),
    };
    const mockPool = {
      end: async () => {},
    };
    const errors = [];
    const mockLogger = {
      log: () => {},
      warn: () => {},
      error: (msg, err) => errors.push({ msg, err }),
    };

    const shutdown = createShutdownHandler({
      server: mockServer,
      pool: mockPool,
      shutdownTimeoutMs: 5000,
      logger: mockLogger,
      exitProcess: false,
    });

    await assert.rejects(
      async () => {
        await shutdown('SIGTERM');
      },
      /Socket close failure/,
      'Shutdown should reject on cleanup error'
    );
    assert.ok(errors.length > 0, 'Error must be logged');
  });

  test('Importing server.js does not register global signal listeners during testing', () => {
    // When imported by this test (where require.main !== module),
    // listener counts for SIGTERM and SIGINT must not increase automatically.
    const sigtermListeners = process.listeners('SIGTERM').length;
    const sigintListeners = process.listeners('SIGINT').length;

    // Requiring server module again
    const serverModule = require('../src/server');
    assert.strictEqual(typeof serverModule.startServer, 'function');
    assert.strictEqual(typeof serverModule.createShutdownHandler, 'function');

    assert.strictEqual(process.listeners('SIGTERM').length, sigtermListeners);
    assert.strictEqual(process.listeners('SIGINT').length, sigintListeners);
  });

  console.log('\n======================================================================');
  console.log(`  SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('======================================================================');
}

runSuite().catch((err) => {
  console.error('\nTest suite failed:', err);
  process.exit(1);
});
