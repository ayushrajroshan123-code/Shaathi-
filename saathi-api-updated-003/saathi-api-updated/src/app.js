const express = require('express');
const cors = require('cors');
const { loadActor, errorHandler } = require('./middleware/context');
const { pool } = require('./db');

const { publicRouter: authPublicRouter, protectedRouter: authProtectedRouter } = require('./routes/auth');
const usersRouter = require('./routes/users');
const coverageRouter = require('./routes/coverage');
const resourcesRouter = require('./routes/resources');
const coordinationsRouter = require('./routes/coordinations');
const conductRouter = require('./routes/conduct');
const issuesRouter = require('./routes/issues');
const queriesRouter = require('./routes/queries');
const emergencyRouter = require('./routes/emergency');

const app = express();

/**
 * Resolves and validates allowed CORS origins from environment.
 *
 * Requirements enforced:
 * - Parses comma-separated origins, trimming whitespace and ignoring empty entries.
 * - Exact origin matching: no reflection of arbitrary request origins.
 * - In production (NODE_ENV === 'production'):
 *   - Explicit, fail-closed behavior: ALLOWED_ORIGINS is required and non-empty.
 *   - Strictly rejects wildcard '*' or wildcard domains.
 *   - Strictly rejects malformed origins, non-HTTP/HTTPS protocols, or pathnames/queries/hashes.
 * - In development / testing (NODE_ENV !== 'production'):
 *   - If ALLOWED_ORIGINS is provided, parses and validates it.
 *   - If ALLOWED_ORIGINS is omitted or empty, falls back to standard local Vite frontend origins:
 *     ['http://localhost:5173', 'http://127.0.0.1:5173']
 *     to keep local development functional out of the box.
 */
function resolveAllowedOrigins(rawOrigins = process.env.ALLOWED_ORIGINS, nodeEnv = process.env.NODE_ENV) {
  const isProduction = nodeEnv === 'production';
  const origins = (rawOrigins || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (isProduction && origins.length === 0) {
    throw new Error(
      'ALLOWED_ORIGINS environment variable is required and must not be empty in production.'
    );
  }

  const validated = [];
  for (const origin of origins) {
    if (origin.includes('*')) {
      throw new Error(`Wildcard origins are not permitted in ALLOWED_ORIGINS: "${origin}".`);
    }

    try {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`Invalid protocol "${parsed.protocol}". Must be http: or https:.`);
      }
      if (parsed.pathname && parsed.pathname !== '/') {
        throw new Error(`Origin must not contain a path: "${origin}"`);
      }
      if (parsed.search || parsed.hash) {
        throw new Error(`Origin must not contain query parameters or hashes: "${origin}"`);
      }
      validated.push(parsed.origin);
    } catch (err) {
      throw new Error(`Invalid origin in ALLOWED_ORIGINS: "${origin}" (${err.message}).`);
    }
  }

  if (validated.length === 0 && !isProduction) {
    return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  }

  return validated;
}

app.resolveAllowedOrigins = resolveAllowedOrigins;

let allowedOrigins;
try {
  allowedOrigins = resolveAllowedOrigins();
} catch (err) {
  if (process.env.NODE_ENV === 'production') {
    throw err;
  }
  // In development, log safe warning and fallback to localhost:5173
  console.warn(`[cors] Configuration warning: ${err.message}. Defaulting to localhost:5173.`);
  allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin header (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json());

/**
 * Liveness Probe
 * Verifies that the HTTP process is active and accepting requests.
 */
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ok', check: 'liveness' });
});

/**
 * Database Readiness Check Handler
 * Executes a bounded database query to verify that PostgreSQL is reachable.
 * Never discloses credentials, internal query structures, or error stack traces.
 */
async function databaseReadinessHandler(req, res) {
  const timeoutMs = Number(process.env.DB_READINESS_TIMEOUT_MS) || 2000;
  let timer;

  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('DATABASE_CHECK_TIMEOUT'));
      }, timeoutMs);
    });

    await Promise.race([
      pool.query('SELECT 1'),
      timeoutPromise,
    ]);

    clearTimeout(timer);
    return res.status(200).json({
      status: 'ok',
      database: 'connected',
    });
  } catch {
    if (timer) clearTimeout(timer);
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: 'DATABASE_UNAVAILABLE',
    });
  }
}

/**
 * Readiness Probe
 * Indicates readiness to serve traffic requiring database persistence.
 */
app.get('/health/ready', databaseReadinessHandler);

/**
 * Unified Health Endpoint
 * Performs database readiness verification for platforms with a single health check.
 */
app.get('/health', databaseReadinessHandler);

// Signup/login ARE how a session is obtained, so they must run before
// loadActor — an unauthenticated caller has to be able to reach them.
app.use('/auth', authPublicRouter);

// Every route below requires a valid session (Authorization: Bearer <token>
// from POST /auth/login). See middleware/context.js.
app.use(loadActor);

// Logout needs to know which session to revoke, so it's mounted after
// loadActor even though it lives under the same /auth prefix as the public
// routes above.
app.use('/auth', authProtectedRouter);

app.use('/users', usersRouter);
app.use('/coverage-requests', coverageRouter);
app.use('/resources', resourcesRouter);
app.use('/coordinations', coordinationsRouter);
app.use('/conduct-reports', conductRouter);
app.use('/issues', issuesRouter);
app.use('/queries', queriesRouter);

// Phase boundary: schema explicitly says emergency functionality exists for
// later phases and "is not exposed by the Phase 1 API." Gated behind an
// explicit opt-in env var rather than being live by default, so a real
// Phase 1 deploy doesn't expose it just because nobody remembered to
// delete a line before shipping. Set ENABLE_EMERGENCY_ROUTES=true only in
// environments where this phase is actually meant to be live.
if (process.env.ENABLE_EMERGENCY_ROUTES === 'true') {
  app.use('/', emergencyRouter);
}

app.use(errorHandler);

module.exports = app;
