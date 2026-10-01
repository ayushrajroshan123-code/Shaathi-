#!/usr/bin/env node
/**
 * SAATHI pilot seed script.
 *
 * Idempotently inserts:
 *  1. The canonical Phase 1 pilot hub defined in API_CONTRACT.md section 8:
 *       - hub_id: '00000000-0000-0000-0000-000000000001'
 *       - name: 'SAATHI Pilot Hub'
 *       - type: 'RWA'
 *       - roster_source: NULL
 *
 *  2. The canonical Phase 1 pilot coordinator defined in API_CONTRACT.md section 8.1:
 *       - user_id: '00000000-0000-0000-0000-000000000002'
 *       - hub_id: '00000000-0000-0000-0000-000000000001'
 *       - name: 'SAATHI Pilot Coordinator'
 *       - email: 'coordinator@saathi.local'
 *       - role: 'coordinator'
 *       - account_status: 'active'
 *       - password: from SAATHI_PILOT_COORDINATOR_PASSWORD env var
 *
 * Usage:
 *   SAATHI_PILOT_COORDINATOR_PASSWORD="secret" node scripts/seed.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const { hashPassword } = require('../src/services/auth');

const PILOT_HUB = {
  hub_id: '00000000-0000-0000-0000-000000000001',
  name: 'SAATHI Pilot Hub',
  type: 'RWA',
};

const PILOT_COORDINATOR = {
  user_id: '00000000-0000-0000-0000-000000000002',
  hub_id: '00000000-0000-0000-0000-000000000001',
  name: 'SAATHI Pilot Coordinator',
  email: 'coordinator@saathi.local',
  role: 'coordinator',
  account_status: 'active',
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (check .env).');
    process.exit(1);
  }

  const coordinatorPassword = process.env.SAATHI_PILOT_COORDINATOR_PASSWORD;
  if (!coordinatorPassword) {
    console.error('SAATHI_PILOT_COORDINATOR_PASSWORD environment variable is required to seed the pilot coordinator.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // 1. Seed Pilot Hub
    const hubRes = await client.query(
      `INSERT INTO hubs (hub_id, name, type, roster_source)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT (hub_id) DO UPDATE
         SET name = EXCLUDED.name,
             type = EXCLUDED.type
       RETURNING hub_id, name, type, roster_source, created_at;`,
      [PILOT_HUB.hub_id, PILOT_HUB.name, PILOT_HUB.type]
    );
    console.log(`✓ Pilot hub seeded/verified: ${hubRes.rows[0].name} (${hubRes.rows[0].hub_id})`);

    // 2. Seed Pilot Coordinator
    const passwordHash = hashPassword(coordinatorPassword);
    const coordRes = await client.query(
      `INSERT INTO users (user_id, hub_id, name, email, password_hash, role, account_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE
         SET hub_id = EXCLUDED.hub_id,
             name = EXCLUDED.name,
             email = EXCLUDED.email,
             password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             account_status = EXCLUDED.account_status
       RETURNING user_id, name, email, role, account_status;`,
      [
        PILOT_COORDINATOR.user_id,
        PILOT_COORDINATOR.hub_id,
        PILOT_COORDINATOR.name,
        PILOT_COORDINATOR.email,
        passwordHash,
        PILOT_COORDINATOR.role,
        PILOT_COORDINATOR.account_status,
      ]
    );
    console.log(`✓ Pilot coordinator seeded/verified: ${coordRes.rows[0].email} (${coordRes.rows[0].user_id})`);

  } catch (err) {
    console.error(`✗ Failed to seed database: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
