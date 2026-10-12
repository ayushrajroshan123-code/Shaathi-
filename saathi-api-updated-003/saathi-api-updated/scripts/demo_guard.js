/**
 * SAATHI Demo Safety Guard
 *
 * Enforces a fail-closed boundary for demo seed and reset operations.
 * Prevents execution against development, test, and production databases.
 *
 * Requirements enforced:
 * 1. DEMO_MODE must be strictly 'true'.
 * 2. ALLOW_DEMO_RESET must be strictly 'true'.
 * 3. EXPECTED_DEMO_DB_NAME must be explicitly set to 'saathi_demo'.
 * 4. EXPECTED_DEMO_ROLE must be explicitly configured and non-empty (e.g., 'saathi_demo_user').
 * 5. DATABASE_URL must be non-empty and must not contain production keywords or forbidden DB paths.
 * 6. Uses shared getPoolConfig(env) to preserve TLS and timeout configuration.
 * 7. Live query 'SELECT current_database()' must return exactly 'saathi_demo'.
 * 8. Live query 'SELECT current_user' must match EXPECTED_DEMO_ROLE.
 * 9. Explicitly refuses known development, test, or production databases (saathi, saathi_test, etc.).
 * 10. Fails closed on any contradictory, malformed, or missing configuration.
 * 11. All checks execute before any data is written or deleted.
 *
 * SECURITY NOTE ON POSTGRESQL PERMISSIONS:
 * Environment variable verification is an operational safeguard, NOT a substitute for PostgreSQL
 * database-level permissions. The demo database role (EXPECTED_DEMO_ROLE) MUST be a dedicated,
 * least-privileged PostgreSQL role. It must possess NO superuser (NOSUPERUSER), database-creation (NOCREATEDB),
 * role-creation (NOCREATEROLE), or replication (NOREPLICATION) privileges, and must have NO access,
 * grants, or connect privileges on other application databases (such as 'saathi' or 'saathi_test').
 */

const { getPoolConfig } = require('../src/db');
const { Pool } = require('pg');

const FORBIDDEN_DATABASES = [
  'saathi',
  'saathi_test',
  'saathi_dev',
  'saathi_development',
  'saathi_prod',
  'saathi_production',
  'postgres',
  'template1',
];

async function verifyDemoEnvironment(options = {}) {
  const env = options.env || process.env;
  const mockClient = options.client;

  // 1. DEMO_MODE check
  if (env.DEMO_MODE !== 'true') {
    throw new Error(
      'REFUSAL: DEMO_MODE must be explicitly configured as "true" to authorize demo operations.'
    );
  }

  // 2. ALLOW_DEMO_RESET check
  if (env.ALLOW_DEMO_RESET !== 'true') {
    throw new Error(
      'REFUSAL: ALLOW_DEMO_RESET must be explicitly configured as "true" to authorize demo data mutations.'
    );
  }

  // 3. EXPECTED_DEMO_DB_NAME check
  const expectedDb = env.EXPECTED_DEMO_DB_NAME;
  if (!expectedDb || expectedDb.trim() !== 'saathi_demo') {
    throw new Error(
      `REFUSAL: EXPECTED_DEMO_DB_NAME must be explicitly configured as "saathi_demo" (received: "${expectedDb || ''}").`
    );
  }

  // 4. EXPECTED_DEMO_ROLE check (Mandatory role isolation)
  const expectedRole = env.EXPECTED_DEMO_ROLE;
  if (!expectedRole || !expectedRole.trim()) {
    throw new Error(
      'REFUSAL: EXPECTED_DEMO_ROLE must be explicitly configured and non-empty (e.g. "saathi_demo_user") to ensure execution under a dedicated, least-privileged role.'
    );
  }

  // 5. DATABASE_URL check
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl || !dbUrl.trim()) {
    throw new Error('REFUSAL: DATABASE_URL environment variable is required and must not be empty.');
  }

  // 8a. Prohibit production keywords in connection string
  const lowerUrl = dbUrl.toLowerCase();
  if (lowerUrl.includes('prod') || lowerUrl.includes('production')) {
    throw new Error(
      'REFUSAL: DATABASE_URL contains production identifiers. Refusing demo operation to protect live data.'
    );
  }

  // 8b. Prohibit forbidden database paths in URL
  try {
    const parsed = new URL(dbUrl);
    const dbPath = (parsed.pathname || '').replace(/^\//, '').toLowerCase();
    if (FORBIDDEN_DATABASES.includes(dbPath)) {
      throw new Error(
        `REFUSAL: DATABASE_URL targets forbidden database "${dbPath}". Demo operations are permitted ONLY on "saathi_demo".`
      );
    }
  } catch (err) {
    if (err.message.startsWith('REFUSAL:')) throw err;
    // URL parsing fallback: non-standard connection strings are validated by live database query
  }

  // 5. Connect and execute live verification queries
  let queryClient = mockClient;
  let shouldRelease = false;
  let tempPool = null;

  if (!queryClient) {
    const poolConfig = getPoolConfig(env);
    tempPool = new Pool(poolConfig);
    queryClient = await tempPool.connect();
    shouldRelease = true;
  }

  try {
    // 6. Live database identity query
    const { rows: dbRows } = await queryClient.query('SELECT current_database() AS current_db');
    const actualDb = dbRows && dbRows[0] ? dbRows[0].current_db : null;

    if (!actualDb) {
      throw new Error('REFUSAL: Unable to resolve live database identity from PostgreSQL.');
    }

    if (actualDb !== 'saathi_demo') {
      throw new Error(
        `REFUSAL: Live database identity mismatch! Connected to "${actualDb}", but demo operations are restricted strictly to "saathi_demo".`
      );
    }

    if (FORBIDDEN_DATABASES.includes(actualDb.toLowerCase())) {
      throw new Error(
        `REFUSAL: Live database "${actualDb}" is a protected non-demo database. Execution aborted.`
      );
    }

    // 7. Mandatory live database role check
    const { rows: roleRows } = await queryClient.query('SELECT current_user AS current_role');
    const actualRole = roleRows && roleRows[0] ? roleRows[0].current_role : null;

    if (!actualRole) {
      throw new Error('REFUSAL: Unable to resolve live database role identity from PostgreSQL.');
    }

    if (actualRole !== expectedRole.trim()) {
      throw new Error(
        `REFUSAL: Connected database role mismatch! Expected demo role "${expectedRole.trim()}", but connected as "${actualRole}".`
      );
    }

    return {
      verified: true,
      database: actualDb,
      role: actualRole,
    };
  } finally {
    if (shouldRelease && queryClient) {
      queryClient.release();
    }
    if (tempPool) {
      await tempPool.end();
    }
  }
}

module.exports = {
  verifyDemoEnvironment,
  FORBIDDEN_DATABASES,
};
