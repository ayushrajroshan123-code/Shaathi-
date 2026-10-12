#!/usr/bin/env node
/**
 * SAATHI Demo Reset Script
 *
 * Safely resets the dedicated saathi_demo database by truncating operational tables
 * and re-applying the agreed fictional demo seed baseline.
 *
 * Enforces fail-closed safety guards via scripts/demo_guard.js before any mutation.
 * Refuses execution against development, test, and production databases.
 *
 * Usage:
 *   DEMO_MODE=true ALLOW_DEMO_RESET=true EXPECTED_DEMO_DB_NAME=saathi_demo EXPECTED_DEMO_ROLE=saathi_demo_user DATABASE_URL=postgres://saathi_demo_user:...@localhost:5432/saathi_demo node scripts/reset_demo.js
 */

const { Pool } = require('pg');
const { getPoolConfig } = require('../src/db');
const { verifyDemoEnvironment } = require('./demo_guard');
const { seedDemo } = require('./seed_demo');

// Operational tables to truncate in foreign-key safe cascade order.
// NOTE: 'schema_migrations' (runner infrastructure) and 'task_taxonomy' (canonical taxonomy)
// are intentionally EXCLUDED to preserve schema integrity.
const RESET_TABLES = [
  'coordination_messages',
  'coordination_events',
  'coordinations',
  'resource_requests',
  'resource_inventory',
  'neighborhood_query_answers',
  'neighborhood_queries',
  'neighborhood_issues',
  'conduct_reports',
  'blocked_users',
  'access_handoffs',
  'coverage_requests',
  'verification_records',
  'sessions',
  'notifications',
  'priority_overrides',
  'sos_events',
  'incident_resources',
  'incident_helpers',
  'help_requests',
  'incidents',
  'emergency_alerts',
  'users',
  'hubs',
];

async function resetDemo(options = {}) {
  const env = options.env || process.env;
  let client = options.client;
  let pool = options.pool;
  let shouldClosePool = false;

  // 1. Enforce fail-closed safety guards BEFORE any mutation or deletion
  await verifyDemoEnvironment({ env, client });

  if (!client) {
    if (!pool) {
      const poolConfig = getPoolConfig(env);
      pool = new Pool(poolConfig);
      shouldClosePool = true;
    }
    client = await pool.connect();
  }

  try {
    await client.query('BEGIN');

    // 2. Transactional truncate of operational tables
    // In PostgreSQL, TRUNCATE ... CASCADE bypasses row-level triggers (like prevent_coordination_event_mutation)
    // while remaining fully transactional and rollback-capable.
    const truncateSql = `TRUNCATE TABLE ${RESET_TABLES.join(', ')} CASCADE;`;
    await client.query(truncateSql);

    // 3. Immediately re-seed with agreed fictional baseline using the verified client
    const seedResult = await seedDemo({ client, env });

    await client.query('COMMIT');
    return {
      success: true,
      resetTablesCount: RESET_TABLES.length,
      counts: seedResult.counts,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback failure on broken connection
    }
    throw err;
  } finally {
    if (options.client !== client) {
      client.release();
    }
    if (shouldClosePool && pool) {
      await pool.end();
    }
  }
}

async function main() {
  try {
    const result = await resetDemo();
    console.log('✓ Demo database successfully reset and re-seeded:');
    console.log(`  - Operational tables truncated: ${result.resetTablesCount}`);
    console.log(`  - Hubs: ${result.counts.hubs}`);
    console.log(`  - Personas: ${result.counts.users}`);
    console.log(`  - Resources: ${result.counts.resources}`);
    console.log(`  - Coordinations: ${result.counts.coordinations}`);
    console.log(`  - Issues: ${result.counts.issues}`);
    console.log(`  - Queries: ${result.counts.queries}`);
    console.log('✓ Baseline restored. Emergency routes remain disabled.');
  } catch (err) {
    console.error(`✗ Demo reset refused or failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  require('dotenv').config();
  main();
}

module.exports = {
  resetDemo,
  RESET_TABLES,
};
