require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

/**
 * Sanitize a database connection string for safe logging.
 * Replaces credentials with '***' to prevent secret leakage in logs.
 */
function sanitizeConnectionString(connectionString) {
  if (!connectionString || typeof connectionString !== 'string') return '';
  try {
    const parsed = new URL(connectionString);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return connectionString.replace(/:([^:@]+)@/, ':***@');
  }
}

/**
 * Resolve PostgreSQL Pool configuration from environment variables.
 * Consistent across runtime application and migration runner.
 *
 * Requirements enforced:
 * - Preserves plain TCP local connection when DATABASE_SSL is omitted or disabled.
 * - Supports explicit TLS configuration via DATABASE_SSL ('true', 'require', etc.).
 * - Avoids blind rejectUnauthorized: false — defaults to true unless explicitly overridden.
 * - Supports CA certificate via DATABASE_SSL_CA_PATH or DATABASE_SSL_CA.
 * - Fails clearly on invalid values or missing CA files.
 */
function getPoolConfig(env = process.env) {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const config = {
    connectionString,
    connectionTimeoutMillis: Number(env.DATABASE_CONNECT_TIMEOUT_MS) || 5000,
  };

  if (env.DATABASE_MAX_POOL_SIZE) {
    const max = Number(env.DATABASE_MAX_POOL_SIZE);
    if (Number.isInteger(max) && max > 0) {
      config.max = max;
    }
  }

  if (env.DATABASE_IDLE_TIMEOUT_MS) {
    const idle = Number(env.DATABASE_IDLE_TIMEOUT_MS);
    if (Number.isInteger(idle) && idle >= 0) {
      config.idleTimeoutMillis = idle;
    }
  }

  // Determine TLS / SSL configuration
  const rawSsl = env.DATABASE_SSL ? String(env.DATABASE_SSL).trim().toLowerCase() : undefined;
  let useSsl = false;

  if (rawSsl !== undefined) {
    const disabledValues = ['false', '0', 'off', 'disable', 'no'];
    const enabledValues = ['true', '1', 'on', 'require', 'verify-ca', 'verify-full', 'yes'];

    if (disabledValues.includes(rawSsl)) {
      useSsl = false;
    } else if (enabledValues.includes(rawSsl)) {
      useSsl = true;
    } else {
      throw new Error(
        `Invalid DATABASE_SSL configuration: "${env.DATABASE_SSL}". Allowed values: true, false, require, verify-ca, verify-full, disable.`
      );
    }
  } else {
    // Check if sslmode query param is set in connection string
    try {
      const parsedUrl = new URL(connectionString);
      const sslmode = parsedUrl.searchParams.get('sslmode');
      if (sslmode === 'disable') {
        useSsl = false;
      } else if (sslmode === 'require' || sslmode === 'verify-ca' || sslmode === 'verify-full') {
        useSsl = true;
      }
    } catch {
      // ignore URL parse errors here; pg driver handles connectionString parsing
    }
  }

  if (useSsl) {
    let rejectUnauthorized = true;
    if (env.DATABASE_SSL_REJECT_UNAUTHORIZED !== undefined) {
      const rawReject = String(env.DATABASE_SSL_REJECT_UNAUTHORIZED).trim().toLowerCase();
      if (rawReject === 'false' || rawReject === '0' || rawReject === 'no') {
        rejectUnauthorized = false;
      } else if (rawReject === 'true' || rawReject === '1' || rawReject === 'yes') {
        rejectUnauthorized = true;
      } else {
        throw new Error(
          `Invalid DATABASE_SSL_REJECT_UNAUTHORIZED value: "${env.DATABASE_SSL_REJECT_UNAUTHORIZED}". Expected "true" or "false".`
        );
      }
    }

    const sslConfig = { rejectUnauthorized };

    // Custom CA certificate handling
    if (env.DATABASE_SSL_CA_PATH) {
      const caPath = env.DATABASE_SSL_CA_PATH.trim();
      if (!fs.existsSync(caPath)) {
        throw new Error(`DATABASE_SSL_CA_PATH file not found: "${caPath}"`);
      }
      sslConfig.ca = fs.readFileSync(caPath, 'utf8');
    } else if (env.DATABASE_SSL_CA) {
      sslConfig.ca = env.DATABASE_SSL_CA;
    }

    config.ssl = sslConfig;
  }

  return config;
}

/**
 * Instantiate a pg.Pool with error handling for unexpected idle client errors.
 */
function createPool(env = process.env) {
  const config = getPoolConfig(env);
  const newPool = new Pool(config);

  newPool.on('error', (err) => {
    // Log safe error without connection strings or credentials
    // eslint-disable-next-line no-console
    console.error('[db] Unexpected error on idle PostgreSQL client:', err?.message || err);
  });

  return newPool;
}

const pool = createPool(process.env);

/**
 * Thin query wrapper. Every handler goes through here so we have one place
 * to add logging/metrics later without touching route code.
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run a callback inside a transaction. Used anywhere we do a read-then-write
 * that must be atomic (e.g. status transitions guarded by an authorization
 * check, or anything the DB triggers alone can't fully protect).
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  withTransaction,
  getPoolConfig,
  createPool,
  sanitizeConnectionString,
};
