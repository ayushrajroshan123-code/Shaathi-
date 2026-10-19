/**
 * SAATHI Phase 2H Step 4B: Demo Database Boundary and Seed/Reset Safety Suite
 *
 * Deterministic, isolated safety tests:
 * 1. Missing DEMO_MODE refuses execution.
 * 2. Missing ALLOW_DEMO_RESET refuses execution.
 * 3. Missing or incorrect EXPECTED_DEMO_DB_NAME refuses execution.
 * 4. Missing or empty DATABASE_URL refuses execution.
 * 5. Production keywords in DATABASE_URL refuse execution.
 * 6. Target URL pointing to forbidden database paths (saathi, saathi_test, postgres) refuses execution.
 * 7. Live database name mismatch refuses execution.
 * 8. Live database returning development identity (saathi) refuses execution.
 * 9. Live database returning test identity (saathi_test) refuses execution.
 * 10. Missing or undefined EXPECTED_DEMO_ROLE refuses execution.
 * 11. Empty or whitespace-only EXPECTED_DEMO_ROLE refuses execution.
 * 12. Database role mismatch refuses execution when EXPECTED_DEMO_ROLE does not match connected role.
 * 13. Database role match succeeds when EXPECTED_DEMO_ROLE matches connected role.
 * 14. Zero seed mutations execute before all safety guards pass.
 * 15. Zero reset/truncate mutations execute before all safety guards pass.
 * 16. Successful seedDemo runs within a transaction (BEGIN ... COMMIT).
 * 17. Failed seedDemo triggers transactional ROLLBACK.
 * 18. Successful resetDemo executes TRUNCATE TABLE ... CASCADE and re-seeds within a transaction.
 * 19. Failed resetDemo triggers transactional ROLLBACK.
 * 20. RESET_TABLES excludes schema_migrations and task_taxonomy.
 * 21. Fictional personas use properly hashed passwords (no plaintext).
 */

const assert = require('assert');
const { verifyDemoEnvironment, FORBIDDEN_DATABASES } = require('../scripts/demo_guard');
const { seedDemo, DEMO_IDS } = require('../scripts/seed_demo');
const { resetDemo, RESET_TABLES } = require('../scripts/reset_demo');
const { verifyPassword } = require('../src/services/auth');

let totalTests = 0;
let passedTests = 0;

async function test(name, fn) {
  totalTests += 1;
  try {
    await fn();
    passedTests += 1;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

function createMockClient(options = {}) {
  const currentDb = options.currentDb !== undefined ? options.currentDb : 'saathi_demo';
  const currentUser = options.currentUser !== undefined ? options.currentUser : 'saathi_demo_user';
  const queryHistory = [];

  return {
    queryHistory,
    query: async (sql, params = []) => {
      queryHistory.push({ sql: sql.trim(), params });
      if (typeof sql === 'string' && sql.includes('SELECT current_database()')) {
        return { rows: [{ current_db: currentDb }] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT current_user')) {
        return { rows: [{ current_role: currentUser }] };
      }
      if (options.failOnSql && typeof sql === 'string' && sql.includes(options.failOnSql)) {
        throw new Error(`Simulated database failure on ${options.failOnSql}`);
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => {},
  };
}

const VALID_DEMO_ENV = {
  DEMO_MODE: 'true',
  ALLOW_DEMO_RESET: 'true',
  EXPECTED_DEMO_DB_NAME: 'saathi_demo',
  EXPECTED_DEMO_ROLE: 'saathi_demo_user',
  DATABASE_URL: 'postgres://saathi_demo_user:safe_demo_pass@localhost:5432/saathi_demo',
};

async function runSuite() {
  console.log('=== Running Phase 2H Step 4B Demo Boundary and Safety Tests ===\n');

  // Test 1: Missing DEMO_MODE
  await test('Refuses execution when DEMO_MODE is missing or not "true"', async () => {
    const env = { ...VALID_DEMO_ENV, DEMO_MODE: 'false' };
    const mockClient = createMockClient();
    await assert.rejects(
      async () => verifyDemoEnvironment({ env, client: mockClient }),
      /REFUSAL: DEMO_MODE must be explicitly configured as "true"/
    );
  });

  // Test 2: Missing ALLOW_DEMO_RESET
  await test('Refuses execution when ALLOW_DEMO_RESET is missing or not "true"', async () => {
    const env = { ...VALID_DEMO_ENV, ALLOW_DEMO_RESET: 'false' };
    const mockClient = createMockClient();
    await assert.rejects(
      async () => verifyDemoEnvironment({ env, client: mockClient }),
      /REFUSAL: ALLOW_DEMO_RESET must be explicitly configured as "true"/
    );
  });

  // Test 3: Missing or invalid EXPECTED_DEMO_DB_NAME
  await test('Refuses execution when EXPECTED_DEMO_DB_NAME is not "saathi_demo"', async () => {
    const env = { ...VALID_DEMO_ENV, EXPECTED_DEMO_DB_NAME: 'saathi' };
    const mockClient = createMockClient();
    await assert.rejects(
      async () => verifyDemoEnvironment({ env, client: mockClient }),
      /REFUSAL: EXPECTED_DEMO_DB_NAME must be explicitly configured as "saathi_demo"/
    );
  });

  // Test 4: Missing or empty DATABASE_URL
  await test('Refuses execution when DATABASE_URL is empty', async () => {
    const env = { ...VALID_DEMO_ENV, DATABASE_URL: '' };
    const mockClient = createMockClient();
    await assert.rejects(
      async () => verifyDemoEnvironment({ env, client: mockClient }),
      /REFUSAL: DATABASE_URL environment variable is required/
    );
  });

  // Test 5: Production keywords in DATABASE_URL
  await test('Refuses execution when DATABASE_URL contains production keywords', async () => {
    const env = {
      ...VALID_DEMO_ENV,
      DATABASE_URL: 'postgres://user:pass@production-db.internal:5432/saathi_demo',
    };
    const mockClient = createMockClient();
    await assert.rejects(
      async () => verifyDemoEnvironment({ env, client: mockClient }),
      /REFUSAL: DATABASE_URL contains production identifiers/
    );
  });

  // Test 6: Forbidden database path in DATABASE_URL
  await test('Refuses execution when DATABASE_URL targets forbidden database paths', async () => {
    for (const forbidden of ['saathi', 'saathi_test', 'postgres']) {
      const env = {
        ...VALID_DEMO_ENV,
        DATABASE_URL: `postgres://user:pass@localhost:5432/${forbidden}`,
      };
      const mockClient = createMockClient();
      await assert.rejects(
        async () => verifyDemoEnvironment({ env, client: mockClient }),
        new RegExp(`REFUSAL: DATABASE_URL targets forbidden database "${forbidden}"`)
      );
    }
  });

  // Test 7: Live database identity mismatch
  await test('Refuses execution when live SELECT current_database() does not match "saathi_demo"', async () => {
    const env = { ...VALID_DEMO_ENV };
    const mockClient = createMockClient({ currentDb: 'saathi_other' });
    await assert.rejects(
      async () => verifyDemoEnvironment({ env, client: mockClient }),
      /REFUSAL: Live database identity mismatch! Connected to "saathi_other"/
    );
  });

  // Test 8: Live database returns development identity (saathi)
  await test('Refuses execution when live SELECT current_database() returns development database "saathi"', async () => {
    const env = { ...VALID_DEMO_ENV };
    const mockClient = createMockClient({ currentDb: 'saathi' });
    await assert.rejects(
      async () => verifyDemoEnvironment({ env, client: mockClient }),
      /REFUSAL: Live database identity mismatch! Connected to "saathi"/
    );
  });

  // Test 9: Live database returns test identity (saathi_test)
  await test('Refuses execution when live SELECT current_database() returns test database "saathi_test"', async () => {
    const env = { ...VALID_DEMO_ENV };
    const mockClient = createMockClient({ currentDb: 'saathi_test' });
    await assert.rejects(
      async () => verifyDemoEnvironment({ env, client: mockClient }),
      /REFUSAL: Live database identity mismatch! Connected to "saathi_test"/
    );
  });

  // Test 10a: Missing EXPECTED_DEMO_ROLE
  await test('Refuses execution when EXPECTED_DEMO_ROLE is missing or undefined', async () => {
    const env = { ...VALID_DEMO_ENV };
    delete env.EXPECTED_DEMO_ROLE;
    const mockClient = createMockClient();
    await assert.rejects(
      async () => verifyDemoEnvironment({ env, client: mockClient }),
      /REFUSAL: EXPECTED_DEMO_ROLE must be explicitly configured and non-empty/
    );
  });

  // Test 10b: Empty or whitespace EXPECTED_DEMO_ROLE
  await test('Refuses execution when EXPECTED_DEMO_ROLE is empty or whitespace-only', async () => {
    for (const emptyVal of ['', '   ', '\t\n']) {
      const env = { ...VALID_DEMO_ENV, EXPECTED_DEMO_ROLE: emptyVal };
      const mockClient = createMockClient();
      await assert.rejects(
        async () => verifyDemoEnvironment({ env, client: mockClient }),
        /REFUSAL: EXPECTED_DEMO_ROLE must be explicitly configured and non-empty/
      );
    }
  });

  // Test 10c: Role mismatch
  await test('Refuses execution when EXPECTED_DEMO_ROLE does not match connected role', async () => {
    const env = { ...VALID_DEMO_ENV, EXPECTED_DEMO_ROLE: 'dedicated_demo_role' };
    const mockClient = createMockClient({ currentUser: 'postgres_superuser' });
    await assert.rejects(
      async () => verifyDemoEnvironment({ env, client: mockClient }),
      /REFUSAL: Connected database role mismatch!/
    );
  });

  // Test 11: Role match succeeds
  await test('Succeeds when EXPECTED_DEMO_ROLE matches connected role', async () => {
    const env = { ...VALID_DEMO_ENV, EXPECTED_DEMO_ROLE: 'saathi_demo_user' };
    const mockClient = createMockClient({ currentUser: 'saathi_demo_user' });
    const res = await verifyDemoEnvironment({ env, client: mockClient });
    assert.strictEqual(res.verified, true);
    assert.strictEqual(res.database, 'saathi_demo');
    assert.strictEqual(res.role, 'saathi_demo_user');
  });

  // Test 12: Zero seed mutations if guard fails
  await test('Zero seed queries execute if safety guard fails', async () => {
    const badEnv = { ...VALID_DEMO_ENV, DEMO_MODE: 'false' };
    const mockClient = createMockClient();
    await assert.rejects(async () => seedDemo({ env: badEnv, client: mockClient }));
    assert.strictEqual(mockClient.queryHistory.length, 0, 'No query should be issued if guard fails');
  });

  // Test 13: Zero reset mutations if guard fails
  await test('Zero reset/truncate queries execute if safety guard fails', async () => {
    const badEnv = { ...VALID_DEMO_ENV, ALLOW_DEMO_RESET: 'false' };
    const mockClient = createMockClient();
    await assert.rejects(async () => resetDemo({ env: badEnv, client: mockClient }));
    assert.strictEqual(mockClient.queryHistory.length, 0, 'No query should be issued if guard fails');
  });

  // Test 14: Successful seedDemo transaction flow
  await test('seedDemo executes inside a transaction (BEGIN ... COMMIT)', async () => {
    const mockClient = createMockClient();
    const result = await seedDemo({ env: VALID_DEMO_ENV, client: mockClient });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.counts.hubs, 1);
    assert.strictEqual(result.counts.users, 4);
    assert.strictEqual(result.counts.resources, 3);
    assert.strictEqual(result.counts.requests, 1);
    assert.strictEqual(result.counts.coordinations, 1);
    assert.strictEqual(result.counts.issues, 1);
    assert.strictEqual(result.counts.queries, 1);

    const sqlList = mockClient.queryHistory.map((q) => q.sql);
    assert.ok(sqlList.includes('BEGIN'), 'Must start transaction with BEGIN');
    assert.ok(sqlList.includes('COMMIT'), 'Must commit transaction with COMMIT');
    assert.ok(!sqlList.includes('ROLLBACK'), 'Must not rollback on success');
  });

  // Test 15: Failed seedDemo executes ROLLBACK
  await test('seedDemo rolls back transaction on failure', async () => {
    const mockClient = createMockClient({ failOnSql: 'neighborhood_issues' });
    await assert.rejects(
      async () => seedDemo({ env: VALID_DEMO_ENV, client: mockClient }),
      /Simulated database failure on neighborhood_issues/
    );
    const sqlList = mockClient.queryHistory.map((q) => q.sql);
    assert.ok(sqlList.includes('BEGIN'), 'Must have begun transaction');
    assert.ok(sqlList.includes('ROLLBACK'), 'Must have rolled back transaction');
    assert.ok(!sqlList.includes('COMMIT'), 'Must not commit on failure');
  });

  // Test 16: Successful resetDemo truncates and re-seeds transactionally
  await test('resetDemo executes TRUNCATE TABLE ... CASCADE and re-seeds inside a transaction', async () => {
    const mockClient = createMockClient();
    const result = await resetDemo({ env: VALID_DEMO_ENV, client: mockClient });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.resetTablesCount, RESET_TABLES.length);

    const sqlList = mockClient.queryHistory.map((q) => q.sql);
    assert.ok(sqlList.includes('BEGIN'), 'Must begin transaction');
    const truncateCall = sqlList.find((q) => q.startsWith('TRUNCATE TABLE'));
    assert.ok(truncateCall, 'Must issue TRUNCATE TABLE');
    assert.ok(truncateCall.includes('CASCADE'), 'TRUNCATE must specify CASCADE');
    assert.ok(sqlList.includes('COMMIT'), 'Must commit transaction');
  });

  // Test 17: Failed resetDemo executes ROLLBACK
  await test('resetDemo rolls back transaction if re-seed fails', async () => {
    const mockClient = createMockClient({ failOnSql: 'users' });
    await assert.rejects(
      async () => resetDemo({ env: VALID_DEMO_ENV, client: mockClient }),
      /Simulated database failure on users/
    );
    const sqlList = mockClient.queryHistory.map((q) => q.sql);
    assert.ok(sqlList.includes('BEGIN'), 'Must have begun transaction');
    assert.ok(sqlList.includes('ROLLBACK'), 'Must have rolled back transaction');
  });

  // Test 18: RESET_TABLES excludes schema_migrations and task_taxonomy
  await test('RESET_TABLES excludes schema_migrations and task_taxonomy', async () => {
    assert.ok(!RESET_TABLES.includes('schema_migrations'), 'schema_migrations must NOT be truncated');
    assert.ok(!RESET_TABLES.includes('task_taxonomy'), 'task_taxonomy must NOT be truncated');
  });

  // Test 19: Password hashing check
  await test('Fictional demo personas use salted scrypt hashes instead of plaintext', async () => {
    const { hashPassword } = require('../src/services/auth');
    const hash = hashPassword('DemoSecret123!');
    assert.ok(hash.includes(':'), 'Hash must contain salt and hash separator');
    assert.notStrictEqual(hash, 'DemoSecret123!');
    assert.strictEqual(verifyPassword('DemoSecret123!', hash), true);
    assert.strictEqual(verifyPassword('WrongPassword', hash), false);
  });

  console.log(`\n=== All ${passedTests}/${totalTests} Phase 2H Step 4B Tests Passed ===`);
}

if (require.main === module) {
  runSuite().catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}

module.exports = { runSuite };
