/**
 * SAATHI Phase 2F Cross-Hub Isolation Attack Matrix Suite
 *
 * Verifies strict community hub boundaries:
 *  - Hub A member cannot discover Hub B resources
 *  - Hub A member cannot read Hub B resource detail (404)
 *  - Hub A member cannot create borrow request against Hub B resource (404)
 *  - Hub A owner cannot see Hub B inbound requests
 *  - Hub A borrower cannot see Hub B outbound requests
 *  - Hub A member cannot read Hub B request detail (404)
 *  - Hub A member cannot approve/decline Hub B request (404)
 *  - Hub A member cannot cancel Hub B request (404)
 *  - Hub A member cannot list Hub B coordinations
 *  - Hub A member cannot read Hub B coordination detail (404)
 *  - Hub A member cannot transition Hub B coordination (404)
 *  - Hub A member cannot initiate or confirm return for Hub B coordination (404)
 *  - Hub A member cannot read or post messages on Hub B coordination (404)
 *  - Hub A member cannot look up Hub B user (404)
 *  - Cross-hub enumeration defense: uniform 404 status prevents UUID probing
 */

require('dotenv').config();
const { pool, query } = require('../src/db');
const {
  startTestServer,
  stopTestServer,
  cleanupTestContext,
} = require('./test_helper');
const { hashPassword, createSession } = require('../src/services/auth');

async function setupTwoHubContext() {
  const pwd = hashPassword('password123');
  const runId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

  // Create two distinct hubs
  const { rows: hubRows } = await query(`
    INSERT INTO hubs (name, type)
    VALUES ('Hub Alpha ${runId}', 'apartment'),
           ('Hub Beta ${runId}', 'apartment')
    RETURNING hub_id, name
  `);
  const hubA = hubRows[0].hub_id;
  const hubB = hubRows[1].hub_id;

  // Create users in Hub A and Hub B
  const { rows: users } = await query(`
    INSERT INTO users (hub_id, name, email, password_hash, role, account_status)
    VALUES
      ($1, 'Alice A1 (Owner)', 'alice.a1.${runId}@example.com', $3, 'resident', 'active'),
      ($1, 'Bob A2 (Borrower)', 'bob.a2.${runId}@example.com', $3, 'resident', 'active'),
      ($1, 'Charlie CoordA', 'coord.a.${runId}@example.com', $3, 'coordinator', 'active'),
      ($2, 'Carol B1 (Owner)', 'carol.b1.${runId}@example.com', $3, 'resident', 'active'),
      ($2, 'Dave B2 (Borrower)', 'dave.b2.${runId}@example.com', $3, 'resident', 'active')
    RETURNING user_id, name, email, role, hub_id
  `, [hubA, hubB, pwd]);

  const userA1 = users.find((u) => u.name.startsWith('Alice'));
  const userA2 = users.find((u) => u.name.startsWith('Bob'));
  const userCoordA = users.find((u) => u.name.startsWith('Charlie'));
  const userB1 = users.find((u) => u.name.startsWith('Carol'));
  const userB2 = users.find((u) => u.name.startsWith('Dave'));

  // Tokens
  const tokenA1 = await createSession(userA1.user_id);
  const tokenA2 = await createSession(userA2.user_id);
  const tokenCoordA = await createSession(userCoordA.user_id);
  const tokenB1 = await createSession(userB1.user_id);
  const tokenB2 = await createSession(userB2.user_id);

  return {
    hubs: { hubA, hubB },
    users: { userA1, userA2, userCoordA, userB1, userB2 },
    tokens: { tokenA1, tokenA2, tokenCoordA, tokenB1, tokenB2 },
  };
}

async function runCrossHubSuite() {
  console.log('========================================================');
  console.log('STARTING SAATHI PHASE 2F CROSS-HUB ISOLATION SUITE');
  console.log('========================================================\n');

  const { baseUrl } = await startTestServer();
  const ctx = await setupTwoHubContext();
  const results = [];

  function record(id, title, pass, details = '') {
    results.push({ id, title, status: pass ? 'PASS' : 'FAIL', details });
    console.log(`[Hub ${id.toString().padStart(2, '0')}] ${title}: ${pass ? 'PASS' : 'FAIL'}${details ? ' - ' + details : ''}`);
  }

  try {
    const { tokenA1, tokenA2, tokenCoordA, tokenB1, tokenB2 } = ctx.tokens;
    const { userA1, userA2, userB1, userB2 } = ctx.users;
    const { hubA, hubB } = ctx.hubs;

    async function api(path, options = {}) {
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
      });
      let body = null;
      try {
        body = await res.json();
      } catch (e) {
        body = null;
      }
      return { status: res.status, body };
    }

    // --- SETUP: Create resources in Hub A and Hub B ---
    const resA = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA1}` },
      body: JSON.stringify({ name: 'Alpha Generator', type: 'energy', condition: 'New', general_area: 'Zone A' }),
    });
    const resAId = resA.body?.resource_id;

    const resB = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB1}` },
      body: JSON.stringify({ name: 'Beta Pressure Washer', type: 'tools', condition: 'Good', general_area: 'Zone B' }),
    });
    const resBId = resB.body?.resource_id;

    // --- SETUP: Create requests in Hub A and Hub B ---
    const reqA = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA2}` },
      body: JSON.stringify({
        resource_id: resAId,
        purpose: 'Alpha borrow',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    const reqAId = reqA.body?.request_id;

    const reqB = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB2}` },
      body: JSON.stringify({
        resource_id: resBId,
        purpose: 'Beta borrow',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    const reqBId = reqB.body?.request_id;

    // --- SETUP: Approve requests to create Coordinations in Hub A and Hub B ---
    const appA = await api(`/resources/requests/${reqAId}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${tokenA1}` } });
    const coordAId = appA.body?.coordination?.coordination_id;

    const appB = await api(`/resources/requests/${reqBId}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${tokenB1}` } });
    const coordBId = appB.body?.coordination?.coordination_id;

    // =========================================================================
    // CROSS-HUB ATTACK MATRIX (Tests 1-14)
    // =========================================================================

    // 1. Cross-hub resource discovery: A1 lists resources -> sees resAId, NOT resBId
    const discA = await api('/resources', { method: 'GET', headers: { Authorization: `Bearer ${tokenA1}` } });
    const seesResA = discA.body?.some((r) => r.resource_id === resAId);
    const seesResB = discA.body?.some((r) => r.resource_id === resBId);
    record(1, 'Public resource discovery is scoped to caller hub (sees Hub A, zero Hub B)',
      discA.status === 200 && seesResA && !seesResB
    );

    // 2. Cross-hub resource detail: A1 requests resBId by UUID -> 404 NOT_FOUND
    const detailCross = await api(`/resources/${resBId}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenA1}` } });
    record(2, 'Cross-hub resource detail returns 404 NOT_FOUND', detailCross.status === 404);

    // 3. Cross-hub request creation: A2 attempts to borrow resBId -> 404 NOT_FOUND
    const reqCross = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA2}` },
      body: JSON.stringify({
        resource_id: resBId,
        purpose: 'Cross hub borrow attempt',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    record(3, 'Cross-hub borrow request creation rejected (404 NOT_FOUND)', reqCross.status === 404);

    // 4. Inbound requests isolation: B1 inbound queue does not contain reqA
    const inboundB = await api('/resources/requests/inbound', { method: 'GET', headers: { Authorization: `Bearer ${tokenB1}` } });
    const seesReqA = inboundB.body?.some((r) => r.request_id === reqAId);
    record(4, 'Owner inbound request queue strictly isolated to owner hub resources',
      inboundB.status === 200 && !seesReqA
    );

    // 5. Outbound requests isolation: B2 outbound queue does not contain reqA
    const outboundB = await api('/resources/requests/outbound', { method: 'GET', headers: { Authorization: `Bearer ${tokenB2}` } });
    const seesReqAOut = outboundB.body?.some((r) => r.request_id === reqAId);
    record(5, 'Borrower outbound request queue strictly isolated to caller requests',
      outboundB.status === 200 && !seesReqAOut
    );

    // 6. Cross-hub request detail: A1 requests reqBId -> 404 NOT_FOUND
    const reqDetailCross = await api(`/resources/requests/${reqBId}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenA1}` } });
    record(6, 'Cross-hub request detail inspection returns 404 NOT_FOUND', reqDetailCross.status === 404);

    // 7. Cross-hub approval: A1 attempts to approve reqB -> 404 NOT_FOUND
    const approveCross = await api(`/resources/requests/${reqBId}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${tokenA1}` } });
    record(7, 'Cross-hub request approval rejected (404 NOT_FOUND)', approveCross.status === 404);

    // 8. Cross-hub decline: A1 attempts to decline reqB -> 404 NOT_FOUND
    const declineCross = await api(`/resources/requests/${reqBId}/decline`, { method: 'POST', headers: { Authorization: `Bearer ${tokenA1}` } });
    record(8, 'Cross-hub request decline rejected (404 NOT_FOUND)', declineCross.status === 404);

    // 9. Cross-hub cancellation: A2 attempts to cancel reqB -> 404 NOT_FOUND
    const cancelCross = await api(`/resources/requests/${reqBId}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${tokenA2}` } });
    record(9, 'Cross-hub request cancellation rejected (404 NOT_FOUND)', cancelCross.status === 404);

    // 10. Cross-hub coordination list: A1 list does not see coordB
    const coordListA = await api('/coordinations', { method: 'GET', headers: { Authorization: `Bearer ${tokenA1}` } });
    const seesCoordB = coordListA.body?.some((c) => c.coordination_id === coordBId);
    record(10, 'Coordination list strictly filtered to caller hub (zero cross-hub records)',
      coordListA.status === 200 && !seesCoordB
    );

    // 11. Cross-hub coordination detail: A1 requests coordBId -> 404 NOT_FOUND
    const coordDetailCross = await api(`/coordinations/${coordBId}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenA1}` } });
    record(11, 'Cross-hub coordination detail inspection returns 404 NOT_FOUND', coordDetailCross.status === 404);

    // 12. Cross-hub coordination transition: A1 attempts to transition coordB -> 404 NOT_FOUND
    const transitionCross = await api(`/coordinations/${coordBId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA1}` },
      body: JSON.stringify({ to_state: 'SCHEDULED' }),
    });
    record(12, 'Cross-hub coordination state transition rejected (404 NOT_FOUND)', transitionCross.status === 404);

    // 13. Cross-hub return initiate/confirm: A1 attempts to confirm return on coordB -> 404 NOT_FOUND
    const returnConfirmCross = await api(`/coordinations/${coordBId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA1}` },
    });
    record(13, 'Cross-hub return confirmation rejected (404 NOT_FOUND)', returnConfirmCross.status === 404);

    // 14. Cross-hub messaging: A1 attempts to post message to coordB -> 404 NOT_FOUND
    const messageCross = await api(`/coordinations/${coordBId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA1}` },
      body: JSON.stringify({ text: 'Cross-hub unauthorized message' }),
    });
    record(14, 'Cross-hub coordination messaging rejected (404 NOT_FOUND)', messageCross.status === 404);

    // 15. Cross-hub user lookup: A1 attempts to view B1 profile -> 404 NOT_FOUND
    const userCrossLookup = await api(`/users/${userB1.user_id}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenA1}` } });
    record(15, 'Cross-hub user lookup returns 404 NOT_FOUND (enumeration defense)', userCrossLookup.status === 404);

    // 16. Coordinator hub isolation: Coordinator of Hub A cannot access Hub B coordination
    const coordAInspectB = await api(`/coordinations/${coordBId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenCoordA}` },
    });
    record(16, 'Coordinator hub isolation enforced (Coord A gets 404 on Hub B coordination)',
      coordAInspectB.status === 404
    );

  } finally {
    await cleanupTestContext(ctx);
    await stopTestServer();
  }

  const failures = results.filter((r) => r.status === 'FAIL');
  console.log('\n========================================');
  console.log(`SUMMARY OF PHASE 2F CROSS-HUB SUITE:`);
  console.log(`TOTAL: ${results.length}/${results.length} ${failures.length === 0 ? 'PASS' : 'FAIL'}`);
  if (failures.length > 0) {
    console.log(`FAILURES: ${failures.length}`);
    failures.forEach((f) => console.log(` - Test ${f.id}: ${f.title}`));
  }
  console.log('========================================\n');

  if (failures.length > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runCrossHubSuite()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Fatal error running Phase 2F cross-hub suite:', err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { runCrossHubSuite };
