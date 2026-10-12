#!/usr/bin/env node
/**
 * SAATHI Demo Seed Script
 *
 * Idempotently populates the dedicated saathi_demo database with fictional
 * portfolio personas, hub configuration, resources, coordinations, issues, and queries.
 *
 * Enforces fail-closed safety guards via scripts/demo_guard.js before any mutation.
 * Refuses execution against development, test, and production databases.
 *
 * Usage:
 *   DEMO_MODE=true ALLOW_DEMO_RESET=true EXPECTED_DEMO_DB_NAME=saathi_demo EXPECTED_DEMO_ROLE=saathi_demo_user DATABASE_URL=postgres://saathi_demo_user:...@localhost:5432/saathi_demo node scripts/seed_demo.js
 */

const { Pool } = require('pg');
const { getPoolConfig } = require('../src/db');
const { hashPassword } = require('../src/services/auth');
const { verifyDemoEnvironment } = require('./demo_guard');

// Fixed deterministic UUIDs for idempotency
const DEMO_IDS = {
  HUB_ID: '00000000-0000-0000-0000-000000000001',
  COORDINATOR_ID: '00000000-0000-0000-0000-000000000002',
  RESIDENT_ALICE_ID: '00000000-0000-0000-0000-000000000003',
  RESIDENT_BOB_ID: '00000000-0000-0000-0000-000000000004',
  RESIDENT_SARAH_ID: '00000000-0000-0000-0000-000000000005',
  RESOURCE_LADDER_ID: '00000000-0000-0000-0000-000000000101',
  RESOURCE_DRILL_ID: '00000000-0000-0000-0000-000000000102',
  RESOURCE_WHEELCHAIR_ID: '00000000-0000-0000-0000-000000000103',
  REQUEST_LADDER_ID: '00000000-0000-0000-0000-000000000201',
  COORDINATION_LADDER_ID: '00000000-0000-0000-0000-000000000301',
  EVENT_COORDINATION_ID: '00000000-0000-0000-0000-000000000302',
  MESSAGE_COORDINATION_ID: '00000000-0000-0000-0000-000000000303',
  ISSUE_LIGHT_ID: '00000000-0000-0000-0000-000000000401',
  QUERY_WHEELBARROW_ID: '00000000-0000-0000-0000-000000000501',
  ANSWER_WHEELBARROW_ID: '00000000-0000-0000-0000-000000000502',
};

async function seedDemo(options = {}) {
  const env = options.env || process.env;
  let client = options.client;
  let pool = options.pool;
  let shouldClosePool = false;

  // 1. Verify fail-closed safety guards BEFORE any mutation
  await verifyDemoEnvironment({ env, client });

  if (!client) {
    if (!pool) {
      const poolConfig = getPoolConfig(env);
      pool = new Pool(poolConfig);
      shouldClosePool = true;
    }
    client = await pool.connect();
  }

  const counts = {
    hubs: 0,
    users: 0,
    resources: 0,
    requests: 0,
    coordinations: 0,
    issues: 0,
    queries: 0,
  };

  try {
    await client.query('BEGIN');

    // 2. Hub
    const hubRes = await client.query(
      `INSERT INTO hubs (hub_id, name, type, roster_source, emergency_mode)
       VALUES ($1, $2, $3, NULL, false)
       ON CONFLICT (hub_id) DO UPDATE
         SET name = EXCLUDED.name,
             type = EXCLUDED.type,
             emergency_mode = false
       RETURNING hub_id;`,
      [DEMO_IDS.HUB_ID, 'Oakridge Circle Pilot Hub', 'RWA']
    );
    counts.hubs = hubRes.rowCount || 1;

    // 3. Fictional Personas
    const defaultPassword = env.DEMO_USER_PASSWORD || 'DemoSecret123!';
    const passwordHash = hashPassword(defaultPassword);

    const personas = [
      {
        id: DEMO_IDS.COORDINATOR_ID,
        name: 'Kavita Sharma',
        email: 'coordinator@saathi.local',
        role: 'coordinator',
      },
      {
        id: DEMO_IDS.RESIDENT_ALICE_ID,
        name: 'Alice Xu',
        email: 'alice.demo@saathi.local',
        role: 'resident',
      },
      {
        id: DEMO_IDS.RESIDENT_BOB_ID,
        name: 'Bob Yang',
        email: 'bob.demo@saathi.local',
        role: 'resident',
      },
      {
        id: DEMO_IDS.RESIDENT_SARAH_ID,
        name: 'Sarah Chen',
        email: 'sarah.demo@saathi.local',
        role: 'resident',
      },
    ];

    for (const p of personas) {
      await client.query(
        `INSERT INTO users (user_id, hub_id, name, email, password_hash, role, account_status, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', true)
         ON CONFLICT (user_id) DO UPDATE
           SET hub_id = EXCLUDED.hub_id,
               name = EXCLUDED.name,
               email = EXCLUDED.email,
               password_hash = EXCLUDED.password_hash,
               role = EXCLUDED.role,
               account_status = 'active',
               is_active = true;`,
        [p.id, DEMO_IDS.HUB_ID, p.name, p.email, passwordHash, p.role]
      );
      counts.users++;
    }

    // 4. Resources
    const resources = [
      {
        id: DEMO_IDS.RESOURCE_LADDER_ID,
        ownerId: DEMO_IDS.RESIDENT_BOB_ID,
        name: 'Telescoping 12ft Step Ladder',
        type: 'tools',
        condition: 'excellent',
        location: 'Lot 2 Garage Storage',
        generalArea: 'Oakridge Circle West',
        handoffPolicy: 'Pickup at driveway with 1h notice',
      },
      {
        id: DEMO_IDS.RESOURCE_DRILL_ID,
        ownerId: DEMO_IDS.RESIDENT_ALICE_ID,
        name: '18V Cordless Hammer Drill & Bit Set',
        type: 'tools',
        condition: 'good',
        location: 'Lot 1 Side Shed',
        generalArea: 'Oakridge Circle North',
        handoffPolicy: 'Community pickup at Cafe Courtyard',
      },
      {
        id: DEMO_IDS.RESOURCE_WHEELCHAIR_ID,
        ownerId: DEMO_IDS.RESIDENT_SARAH_ID,
        name: 'Foldable Transport Wheelchair',
        type: 'mobility',
        condition: 'good',
        location: 'Lot 4 Front Porch',
        generalArea: 'Oakridge Circle East',
        handoffPolicy: 'Contactless handoff on front porch',
      },
    ];

    for (const r of resources) {
      await client.query(
        `INSERT INTO resource_inventory (
           resource_id, hub_id, owner_id, name, type, condition,
           location, general_area, handoff_policy, allowed_requesters,
           requires_approval, is_active, emergency_opt_in
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Verified neighborhood members', true, true, false)
         ON CONFLICT (resource_id) DO UPDATE
           SET hub_id = EXCLUDED.hub_id,
               owner_id = EXCLUDED.owner_id,
               name = EXCLUDED.name,
               type = EXCLUDED.type,
               condition = EXCLUDED.condition,
               location = EXCLUDED.location,
               general_area = EXCLUDED.general_area,
               handoff_policy = EXCLUDED.handoff_policy,
               is_active = true,
               emergency_opt_in = false;`,
        [
          r.id,
          DEMO_IDS.HUB_ID,
          r.ownerId,
          r.name,
          r.type,
          r.condition,
          r.location,
          r.generalArea,
          r.handoffPolicy,
        ]
      );
      counts.resources++;
    }

    // 5. Resource Request (Alice requests Bob's ladder)
    await client.query(
      `INSERT INTO resource_requests (
         request_id, resource_id, requested_by, requester_id,
         time_window_start, time_window_end, status,
         handoff_method, handoff_preference, purpose, duration
       ) VALUES ($1, $2, $3, $3, '2026-10-15T09:00:00Z', '2026-10-15T17:00:00Z', 'APPROVED', 'pickup', 'pickup', 'Gutter cleaning and inspection', '1 day')
       ON CONFLICT (request_id) DO UPDATE
         SET status = 'APPROVED',
             purpose = EXCLUDED.purpose,
             duration = EXCLUDED.duration;`,
      [DEMO_IDS.REQUEST_LADDER_ID, DEMO_IDS.RESOURCE_LADDER_ID, DEMO_IDS.RESIDENT_ALICE_ID]
    );
    counts.requests++;

    // 6. Coordination (Fulfillment of ladder loan)
    await client.query(
      `INSERT INTO coordinations (
         coordination_id, hub_id, request_id, resource_id,
         requester_id, counterpart_id, title, type, state,
         purpose, handoff_location, scheduled_time, due_time
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'resource', 'SCHEDULED', $8, $9, '2026-10-15T09:00:00Z', '2026-10-15T17:00:00Z')
       ON CONFLICT (coordination_id) DO UPDATE
         SET state = 'SCHEDULED',
             handoff_location = EXCLUDED.handoff_location;`,
      [
        DEMO_IDS.COORDINATION_LADDER_ID,
        DEMO_IDS.HUB_ID,
        DEMO_IDS.REQUEST_LADDER_ID,
        DEMO_IDS.RESOURCE_LADDER_ID,
        DEMO_IDS.RESIDENT_ALICE_ID,
        DEMO_IDS.RESIDENT_BOB_ID,
        'Ladder Loan for Gutter Cleaning',
        'Gutter cleaning and seasonal home maintenance',
        'Driveway of Lot 2',
      ]
    );
    counts.coordinations++;

    // 6b. Coordination Event (immutable audit entry: ON CONFLICT DO NOTHING)
    await client.query(
      `INSERT INTO coordination_events (
         event_id, coordination_id, event_type, actor_id, summary
       ) VALUES ($1, $2, 'SCHEDULED', $3, 'Coordination scheduled for Oct 15 pickup at Lot 2 driveway')
       ON CONFLICT (event_id) DO NOTHING;`,
      [DEMO_IDS.EVENT_COORDINATION_ID, DEMO_IDS.COORDINATION_LADDER_ID, DEMO_IDS.RESIDENT_BOB_ID]
    );

    // 6c. Coordination Message
    await client.query(
      `INSERT INTO coordination_messages (
         message_id, coordination_id, sender_id, text, message_type
       ) VALUES ($1, $2, $3, $4, 'coordination_note')
       ON CONFLICT (message_id) DO UPDATE
         SET text = EXCLUDED.text;`,
      [
        DEMO_IDS.MESSAGE_COORDINATION_ID,
        DEMO_IDS.COORDINATION_LADDER_ID,
        DEMO_IDS.RESIDENT_ALICE_ID,
        'Thanks Bob! I will return the ladder by 5pm.',
      ]
    );

    // 7. Neighborhood Issue
    await client.query(
      `INSERT INTO neighborhood_issues (
         issue_id, hub_id, title, category, severity,
         general_location, reported_by, status, detail, position_3d
       ) VALUES ($1, $2, $3, 'infrastructure', 'low', 'North pathway junction', $4, 'reported', $5, $6::jsonb)
       ON CONFLICT (issue_id) DO UPDATE
         SET title = EXCLUDED.title,
             detail = EXCLUDED.detail,
             status = 'reported';`,
      [
        DEMO_IDS.ISSUE_LIGHT_ID,
        DEMO_IDS.HUB_ID,
        'Flickering Streetlight Near Lot 4',
        DEMO_IDS.RESIDENT_ALICE_ID,
        'Streetlight bulb flickers intermittently after dusk.',
        JSON.stringify({ x: 12.5, y: 0.0, z: -8.2 }),
      ]
    );
    counts.issues++;

    // 8. Neighborhood Query & Answer
    await client.query(
      `INSERT INTO neighborhood_queries (
         query_id, hub_id, creator_id, title, description,
         category, preferred_timing, status
       ) VALUES ($1, $2, $3, $4, $5, 'home_service', 'Weekend morning', 'open')
       ON CONFLICT (query_id) DO UPDATE
         SET title = EXCLUDED.title,
             description = EXCLUDED.description,
             status = 'open';`,
      [
        DEMO_IDS.QUERY_WHEELBARROW_ID,
        DEMO_IDS.HUB_ID,
        DEMO_IDS.RESIDENT_BOB_ID,
        'Recommendations for Garden Wheelbarrow loan',
        'Planning seasonal soil turnover this weekend. Does anyone have a spare wheelbarrow?',
      ]
    );
    counts.queries++;

    await client.query(
      `INSERT INTO neighborhood_query_answers (
         answer_id, query_id, creator_id, body, is_helpful
       ) VALUES ($1, $2, $3, $4, false)
       ON CONFLICT (answer_id) DO UPDATE
         SET body = EXCLUDED.body;`,
      [
        DEMO_IDS.ANSWER_WHEELBARROW_ID,
        DEMO_IDS.QUERY_WHEELBARROW_ID,
        DEMO_IDS.RESIDENT_SARAH_ID,
        'I have one by the greenhouse you are welcome to use!',
      ]
    );

    await client.query('COMMIT');
    return { success: true, counts };
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
    const result = await seedDemo();
    console.log('✓ Demo database successfully seeded:');
    console.log(`  - Hubs: ${result.counts.hubs}`);
    console.log(`  - Personas: ${result.counts.users}`);
    console.log(`  - Resources: ${result.counts.resources}`);
    console.log(`  - Coordinations: ${result.counts.coordinations}`);
    console.log(`  - Issues: ${result.counts.issues}`);
    console.log(`  - Queries: ${result.counts.queries}`);
    console.log('✓ Emergency routes and tables remain untouched and disabled.');
  } catch (err) {
    console.error(`✗ Demo seed refused or failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  require('dotenv').config();
  main();
}

module.exports = {
  seedDemo,
  DEMO_IDS,
};
