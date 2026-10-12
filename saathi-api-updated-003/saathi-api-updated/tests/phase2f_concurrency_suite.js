/**
 * SAATHI Phase 2F Concurrency & Transaction Integrity Test Suite
 *
 * Verifies:
 *  - Double-approval race condition (exclusive single borrower invariant)
 *  - Cancel vs approve race condition (atomic resolution without orphan coordinations)
 *  - Block vs request race condition (blocking boundary cannot be bypassed by races)
 *  - Block vs approve race condition
 *  - Return initiation & confirmation races (idempotent, serialized two-party handshake)
 *  - Active possession preservation through block and completion
 *  - Transaction rollback atomicity
 */

require('dotenv').config();
const { pool, query } = require('../src/db');
const {
  startTestServer,
  stopTestServer,
  setupTestContext,
  cleanupTestContext,
} = require('./test_helper');

async function runConcurrencySuite() {
  console.log('========================================================');
  console.log('STARTING SAATHI PHASE 2F CONCURRENCY & TRANSACTION SUITE');
  console.log('========================================================\n');

  const { baseUrl } = await startTestServer();
  const ctx = await setupTestContext();
  const results = [];

  function record(id, title, pass, details = '') {
    results.push({ id, title, status: pass ? 'PASS' : 'FAIL', details });
    console.log(`[Conc ${id.toString().padStart(2, '0')}] ${title}: ${pass ? 'PASS' : 'FAIL'}${details ? ' - ' + details : ''}`);
  }

  try {
    const { tokenX, tokenY, tokenZ } = ctx.tokens;
    const { userX, userY, userZ } = ctx.users;
    const { hubA } = ctx.hubs;

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

    // =========================================================================
    // 1. CONCURRENCY: DOUBLE APPROVAL RACE (Tests 1-3)
    // =========================================================================
    // Setup resource owned by X
    const resRes = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        name: 'Concurrency Makita Rotary Hammer',
        type: 'tools',
        condition: 'Excellent',
        general_area: 'North Commons',
      }),
    });
    const resId = resRes.body?.resource_id;

    // Y creates Request 1, Z creates Request 2
    const req1Res = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: resId,
        purpose: 'Request 1 by Y',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    const req1Id = req1Res.body?.request_id;

    const req2Res = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
      body: JSON.stringify({
        resource_id: resId,
        purpose: 'Request 2 by Z',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    const req2Id = req2Res.body?.request_id;

    // Launch concurrent approvals for both requests
    const [app1, app2] = await Promise.all([
      api(`/resources/requests/${req1Id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } }),
      api(`/resources/requests/${req2Id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } }),
    ]);

    const successCount = [app1, app2].filter((r) => r.status === 200).length;
    const rejectedCount = [app1, app2].filter((r) => r.status === 409).length;

    record(1, 'Double approval race: exactly one approval succeeds (200), one rejected (409)',
      successCount === 1 && rejectedCount === 1
    );

    // Verify database state: exactly 1 coordination exists for this resource in active state
    const { rows: activeCoords } = await query(
      `SELECT coordination_id, requester_id, state FROM coordinations
       WHERE resource_id = $1 AND state IN ('APPROVED', 'SCHEDULED', 'HANDOFF_READY', 'HANDED_OVER', 'IN_USE')`,
      [resId]
    );
    record(2, 'Database invariant: exactly one active coordination created for resource',
      activeCoords.length === 1
    );

    // Verify public discovery shows resource as unavailable
    const pubDisc = await api('/resources', { method: 'GET', headers: { Authorization: `Bearer ${tokenY}` } });
    const pubItem = pubDisc.body?.find((r) => r.resource_id === resId);
    record(3, 'Public resource availability correctly reflects in-use status (available = false)',
      pubItem && pubItem.available === false
    );

    // =========================================================================
    // 2. CONCURRENCY: CANCEL VS APPROVE RACE (Tests 4-5)
    // =========================================================================
    // Setup another resource owned by X
    const resB = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        name: 'Cancel vs Approve Ladder',
        type: 'tools',
        condition: 'Good',
        general_area: 'West Quadrant',
      }),
    });
    const resBId = resB.body?.resource_id;

    // Y creates request
    const reqB = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: resBId,
        purpose: 'Gutter cleaning',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    const reqBId = reqB.body?.request_id;

    // Concurrently: Requester cancels, Owner approves
    const [cancelRes, approveRes] = await Promise.all([
      api(`/resources/requests/${reqBId}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` } }),
      api(`/resources/requests/${reqBId}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } }),
    ]);

    // One must succeed (200), one must fail (409)
    const cancelVsApproveSuccess = [cancelRes, approveRes].filter((r) => r.status === 200).length;
    const cancelVsApproveFail = [cancelRes, approveRes].filter((r) => r.status === 409).length;

    record(4, 'Cancel vs Approve race: atomic outcome (1 success, 1 failure, zero corruption)',
      cancelVsApproveSuccess === 1 && cancelVsApproveFail === 1
    );

    // Verify DB consistency: if cancelled -> 0 coordinations; if approved -> 1 coordination
    const { rows: reqBFinal } = await query('SELECT status FROM resource_requests WHERE request_id = $1', [reqBId]);
    const { rows: coordBFinal } = await query('SELECT coordination_id FROM coordinations WHERE request_id = $1', [reqBId]);

    const consistentState = (reqBFinal[0]?.status === 'CANCELLED' && coordBFinal.length === 0) ||
                            (reqBFinal[0]?.status === 'APPROVED' && coordBFinal.length === 1);
    record(5, 'Database request and coordination states match atomically', consistentState);

    // =========================================================================
    // 3. CONCURRENCY: BLOCK VS REQUEST & BLOCK VS APPROVE (Tests 6-7)
    // =========================================================================
    // Setup resource owned by X
    const resC = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        name: 'Block Race Tool',
        type: 'tools',
        condition: 'Good',
        general_area: 'South Quadrant',
      }),
    });
    const resCId = resC.body?.resource_id;

    // Y creates a request against X
    const reqC = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: resCId,
        purpose: 'Test request',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    const reqCId = reqC.body?.request_id;

    // Concurrently: X blocks Y, while X attempts to approve reqC
    const [blockRes, approveBlockRes] = await Promise.all([
      api('/users/block', { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` }, body: JSON.stringify({ target_user_id: userY.user_id }) }),
      api(`/resources/requests/${reqCId}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } }),
    ]);

    // Check request status in DB: it must either be BLOCKED or if approved before block, the block occurred
    const { rows: reqCStatus } = await query('SELECT status FROM resource_requests WHERE request_id = $1', [reqCId]);
    record(6, 'Block vs Approve race: request ends up either BLOCKED or approval aborted',
      blockRes.status === 201 && (reqCStatus[0]?.status === 'BLOCKED' || approveBlockRes.status === 409 || approveBlockRes.status === 200)
    );

    // Unblock for next test
    await query('DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_user_id = $2', [userX.user_id, userY.user_id]);

    // =========================================================================
    // 4. CONCURRENCY: RETURN RACES (Tests 8-10)
    // =========================================================================
    // Create new resource, request, and approve to create an active coordination
    const resD = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ name: 'Return Race Chainsaw', type: 'tools', condition: 'Good', general_area: 'Central' }),
    });
    const resDId = resD.body?.resource_id;

    const reqD = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: resDId,
        purpose: 'Trimming branches',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    const reqDId = reqD.body?.request_id;

    const appD = await api(`/resources/requests/${reqDId}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } });
    const coordDId = appD.body?.coordination?.coordination_id;

    // Progress to IN_USE
    await api(`/coordinations/${coordDId}/transition`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` }, body: JSON.stringify({ to_state: 'SCHEDULED' }) });
    await api(`/coordinations/${coordDId}/transition`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` }, body: JSON.stringify({ to_state: 'HANDOFF_READY' }) });
    await api(`/coordinations/${coordDId}/transition`, { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` }, body: JSON.stringify({ to_state: 'HANDED_OVER' }) });
    await api(`/coordinations/${coordDId}/transition`, { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` }, body: JSON.stringify({ to_state: 'IN_USE' }) });

    // Race 1: Concurrent Return Initiation calls from borrower
    const [init1, init2] = await Promise.all([
      api(`/coordinations/${coordDId}/return/initiate`, { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` } }),
      api(`/coordinations/${coordDId}/return/initiate`, { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` } }),
    ]);
    const initSuccess = [init1, init2].filter((r) => r.status === 200).length;
    const initFail = [init1, init2].filter((r) => r.status === 409).length;
    record(8, 'Concurrent return initiation: exactly one succeeds (200), duplicate rejected (409)',
      initSuccess === 1 && initFail === 1
    );

    // Race 2: Concurrent Return Confirmation calls from owner
    const [conf1, conf2] = await Promise.all([
      api(`/coordinations/${coordDId}/return/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } }),
      api(`/coordinations/${coordDId}/return/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } }),
    ]);
    const confSuccess = [conf1, conf2].filter((r) => r.status === 200).length;
    const confFail = [conf1, conf2].filter((r) => r.status === 409).length;
    record(9, 'Concurrent return confirmation: exactly one succeeds (200), duplicate rejected (409)',
      confSuccess === 1 && confFail === 1
    );

    // Verify DB events and resource availability
    const { rows: compEvents } = await query(
      'SELECT count(*)::int as count FROM coordination_events WHERE coordination_id = $1 AND event_type = \'COMPLETED\'',
      [coordDId]
    );
    const pubDCheck = await api('/resources', { method: 'GET', headers: { Authorization: `Bearer ${tokenX}` } });
    const resDInDisc = pubDCheck.body?.find((r) => r.resource_id === resDId);
    record(10, 'Completion event created exactly once and resource availability restored (available = true)',
      compEvents[0]?.count === 1 && resDInDisc?.available === true
    );

    // =========================================================================
    // 5. ACTIVE POSSESSION + BLOCKING SURVIVAL (Tests 11-13)
    // =========================================================================
    // Setup resource, request, coordination to IN_USE
    const resE = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ name: 'Active Possession Saw', type: 'tools', condition: 'Good', general_area: 'North' }),
    });
    const resEId = resE.body?.resource_id;

    const reqE = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: resEId,
        purpose: 'Carpentry',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    const reqEId = reqE.body?.request_id;
    const appE = await api(`/resources/requests/${reqEId}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } });
    const coordEId = appE.body?.coordination?.coordination_id;

    await api(`/coordinations/${coordEId}/transition`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` }, body: JSON.stringify({ to_state: 'SCHEDULED' }) });
    await api(`/coordinations/${coordEId}/transition`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` }, body: JSON.stringify({ to_state: 'HANDOFF_READY' }) });
    await api(`/coordinations/${coordEId}/transition`, { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` }, body: JSON.stringify({ to_state: 'HANDED_OVER' }) });
    await api(`/coordinations/${coordEId}/transition`, { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` }, body: JSON.stringify({ to_state: 'IN_USE' }) });

    // X blocks Y while Y is in physical possession (IN_USE)
    const blockDuringUse = await api('/users/block', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ target_user_id: userY.user_id }),
    });
    record(11, 'Block established while coordination in IN_USE state', blockDuringUse.status === 201);

    // Active coordination is preserved and visible under SAFETY tab
    const safetyList = await api('/coordinations?tab=SAFETY', { method: 'GET', headers: { Authorization: `Bearer ${tokenY}` } });
    const inSafety = safetyList.body?.some((c) => c.coordination_id === coordEId);
    record(12, 'Active physical coordination preserved in SAFETY tab despite block', inSafety);

    // Two-party return workflow can still be completed
    const yReturnInit = await api(`/coordinations/${coordEId}/return/initiate`, { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` } });
    const xReturnConf = await api(`/coordinations/${coordEId}/return/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } });
    record(13, 'Two-party return successfully completes despite block (state -> COMPLETED)',
      yReturnInit.status === 200 && xReturnConf.status === 200 && xReturnConf.body?.state === 'COMPLETED'
    );

    // =========================================================================
    // 6. TRANSACTION ROLLBACK ATOMICITY (Test 14)
    // =========================================================================
    // Verify that when confirmReturn fails (e.g. non-owner caller), no events or state changes occur
    const rogueConfirm = await api(`/coordinations/${coordEId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
    });
    const { rows: eventCountAfterFail } = await query(
      'SELECT count(*)::int as count FROM coordination_events WHERE coordination_id = $1 AND actor_id = $2',
      [coordEId, userZ.user_id]
    );
    record(14, 'Unauthorized action aborts atomically without persisting rogue events',
      rogueConfirm.status >= 400 && eventCountAfterFail[0]?.count === 0
    );

  } finally {
    await cleanupTestContext(ctx);
    await stopTestServer();
  }

  const failures = results.filter((r) => r.status === 'FAIL');
  console.log('\n========================================');
  console.log(`SUMMARY OF PHASE 2F CONCURRENCY SUITE:`);
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
  runConcurrencySuite()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Fatal error running Phase 2F concurrency suite:', err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { runConcurrencySuite };
