/**
 * SAATHI Phase 2D Test Helper
 * Provides server bootstrapping, test user creation, and session tokens.
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool, query } = require('../src/db');
const { hashPassword, createSession } = require('../src/services/auth');
const app = require('../src/app');

let serverInstance = null;
let serverPort = null;

async function startTestServer() {
  if (serverInstance) return { server: serverInstance, port: serverPort, baseUrl: `http://127.0.0.1:${serverPort}` };
  return new Promise((resolve) => {
    serverInstance = http.createServer(app);
    serverInstance.listen(0, '127.0.0.1', () => {
      serverPort = serverInstance.address().port;
      resolve({
        server: serverInstance,
        port: serverPort,
        baseUrl: `http://127.0.0.1:${serverPort}`,
      });
    });
  });
}

async function stopTestServer() {
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
    serverInstance = null;
    serverPort = null;
  }
}

async function assertTestDatabase() {
  const { rows } = await query('SELECT current_database() AS database_name');
  const dbName = rows && rows[0] ? rows[0].database_name : null;
  if (dbName !== 'saathi_test') {
    throw new Error(`FATAL: Database identity mismatch! Expected 'saathi_test', but connected to '${dbName}'. Test execution aborted.`);
  }
}

async function setupTestContext() {
  await assertTestDatabase();

  // 1. Create or ensure two test hubs
  const { rows: hubRows } = await query(`
    INSERT INTO hubs (name, type)
    VALUES ('Hub Alpha', 'apartment'),
           ('Hub Beta', 'apartment')
    RETURNING hub_id, name
  `);
  const hubA = hubRows[0].hub_id;
  const hubB = hubRows[1].hub_id;

  // 2. Create test users: X (owner), Y (borrower), Z (attacker), Coord (coordinator) in Hub A, and CrossUser in Hub B
  const pwd = hashPassword('password123');
  const runId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const emailX = `alice.x.${runId}@example.com`;
  const emailY = `bob.y.${runId}@example.com`;
  const emailZ = `mallory.z.${runId}@example.com`;
  const emailCoord = `charlie.coord.${runId}@example.com`;
  const emailCross = `cross.hub.${runId}@example.com`;

  const { rows: users } = await query(`
    INSERT INTO users (hub_id, name, email, password_hash, role, account_status)
    VALUES
      ($1, 'Alice Owner (X)', $3, $8, 'resident', 'active'),
      ($1, 'Bob Borrower (Y)', $4, $8, 'resident', 'active'),
      ($1, 'Mallory Attacker (Z)', $5, $8, 'resident', 'active'),
      ($1, 'Charlie Coordinator', $6, $8, 'coordinator', 'active'),
      ($2, 'Cross Hub Resident', $7, $8, 'resident', 'active')
    RETURNING user_id, name, email, role, hub_id
  `, [hubA, hubB, emailX, emailY, emailZ, emailCoord, emailCross, pwd]);

  const userX = users.find((u) => u.email === emailX);
  const userY = users.find((u) => u.email === emailY);
  const userZ = users.find((u) => u.email === emailZ);
  const userCoord = users.find((u) => u.email === emailCoord);
  const userCross = users.find((u) => u.email === emailCross);

  // Add verification record for Y so trust signals have verified identity
  await query(`
    INSERT INTO verification_records (user_id, method, verified_by, tier)
    VALUES ($1, 'manual_review', $2, 'standard')
  `, [userY.user_id, userCoord.user_id]);

  // Generate sessions
  const tokenX = await createSession(userX.user_id);
  const tokenY = await createSession(userY.user_id);
  const tokenZ = await createSession(userZ.user_id);
  const tokenCoord = await createSession(userCoord.user_id);
  const tokenCross = await createSession(userCross.user_id);

  return {
    hubs: { hubA, hubB },
    users: { userX, userY, userZ, userCoord, userCross },
    tokens: { tokenX, tokenY, tokenZ, tokenCoord, tokenCross },
  };
}

async function cleanupTestContext(ctx) {
  if (!ctx) return;
  await assertTestDatabase();
  
  const userIds = Object.values(ctx.users).map((u) => u.user_id);
  const hubIds = Object.values(ctx.hubs);

  await query('DELETE FROM coordination_messages WHERE sender_id = ANY($1)', [userIds]);
  await query('ALTER TABLE coordination_events DISABLE TRIGGER trg_coordination_events_immutable');
  try {
    await query('DELETE FROM coordination_events WHERE actor_id = ANY($1)', [userIds]);
  } finally {
    await query('ALTER TABLE coordination_events ENABLE TRIGGER trg_coordination_events_immutable');
  }
  await query('DELETE FROM coordinations WHERE requester_id = ANY($1) OR counterpart_id = ANY($1)', [userIds]);
  await query('DELETE FROM resource_requests WHERE requester_id = ANY($1)', [userIds]);
  await query('DELETE FROM resource_inventory WHERE owner_id = ANY($1)', [userIds]);
  await query('DELETE FROM blocked_users WHERE blocker_id = ANY($1) OR blocked_user_id = ANY($1)', [userIds]);
  await query('DELETE FROM conduct_reports WHERE reported_by = ANY($1) OR reported_against = ANY($1)', [userIds]);
  await query('DELETE FROM neighborhood_query_answers WHERE creator_id = ANY($1)', [userIds]);
  await query('DELETE FROM neighborhood_queries WHERE creator_id = ANY($1)', [userIds]);
  await query('DELETE FROM neighborhood_issues WHERE reported_by = ANY($1)', [userIds]);
  await query('DELETE FROM verification_records WHERE user_id = ANY($1)', [userIds]);
  await query('DELETE FROM sessions WHERE user_id = ANY($1)', [userIds]);
  await query('DELETE FROM users WHERE user_id = ANY($1)', [userIds]);
  await query('DELETE FROM hubs WHERE hub_id = ANY($1)', [hubIds]);
}

module.exports = {
  startTestServer,
  stopTestServer,
  setupTestContext,
  cleanupTestContext,
};
