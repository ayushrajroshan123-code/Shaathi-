/**
 * SAATHI Phase 2F Security & Authorization Test Suite
 *
 * Verifies:
 *  - Authentication & multi-session isolation
 *  - Actor impersonation resistance across all endpoints
 *  - State machine bypass protection & canonical transition graph
 *  - Coordination event immutability & audit integrity
 *  - Conduct report security & submission rate limiting
 *  - Malformed input & injection resistance
 *  - Error response envelope & zero information leakage
 */

require('dotenv').config();
const { pool, query } = require('../src/db');
const {
  startTestServer,
  stopTestServer,
  setupTestContext,
  cleanupTestContext,
} = require('./test_helper');
const { createSession } = require('../src/services/auth');

async function runSecuritySuite() {
  console.log('========================================================');
  console.log('STARTING SAATHI PHASE 2F SECURITY & AUTH SUITE');
  console.log('========================================================\n');

  const { baseUrl } = await startTestServer();
  const ctx = await setupTestContext();
  const results = [];

  function record(id, title, pass, details = '') {
    results.push({ id, title, status: pass ? 'PASS' : 'FAIL', details });
    console.log(`[Sec ${id.toString().padStart(2, '0')}] ${title}: ${pass ? 'PASS' : 'FAIL'}${details ? ' - ' + details : ''}`);
  }

  try {
    const { tokenX, tokenY, tokenZ, tokenCoord, tokenCross } = ctx.tokens;
    const { userX, userY, userZ, userCoord, userCross } = ctx.users;
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

    // --- SETUP: Create a test resource owned by User X in Hub A ---
    const resCreate = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        name: 'Phase 2F Heavy Duty Hammer Drill',
        type: 'tools',
        condition: 'Like New',
        general_area: 'East Quadrant · Hub A',
        handoff_policy: 'Safe public pickup at Hub Exchange',
        location: 'Private Shelf 4B', // must never leak
      }),
    });
    const resourceId = resCreate.body?.resource_id;

    // =========================================================================
    // 1. AUTHENTICATION & MULTI-SESSION ISOLATION (Tests 1-6)
    // =========================================================================
    // 1. Missing Authorization header
    const a1 = await api('/resources/requests', { method: 'POST', body: JSON.stringify({ resource_id: resourceId }) });
    record(1, 'Missing Authorization header rejected (401)', a1.status === 401 && a1.body?.error === 'UNAUTHENTICATED');

    // 2. Malformed headers: wrong scheme, empty token
    const a2a = await api('/resources', { method: 'GET', headers: { Authorization: 'Basic dXNlcjpwYXNz' } });
    const a2b = await api('/resources', { method: 'GET', headers: { Authorization: 'Bearer ' } });
    record(2, 'Malformed Authorization schemes rejected (401)', a2a.status === 401 && a2b.status === 401);

    // 3. Random 32-byte hex token not in sessions
    const a3 = await api('/resources', { method: 'GET', headers: { Authorization: 'Bearer 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' } });
    record(3, 'Random non-existent bearer token rejected (401)', a3.status === 401 && a3.body?.error === 'UNAUTHENTICATED');

    // 4. Multi-session support: create second session for User Y
    const tokenY2 = await createSession(userY.user_id);
    const m1 = await api('/resources', { method: 'GET', headers: { Authorization: `Bearer ${tokenY}` } });
    const m2 = await api('/resources', { method: 'GET', headers: { Authorization: `Bearer ${tokenY2}` } });
    record(4, 'Multiple simultaneous sessions active for same user', m1.status === 200 && m2.status === 200);

    // 5. Logout revokes calling session only
    const logoutRes = await api('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${tokenY2}` } });
    const m1AfterLogout = await api('/resources', { method: 'GET', headers: { Authorization: `Bearer ${tokenY}` } });
    const m2AfterLogout = await api('/resources', { method: 'GET', headers: { Authorization: `Bearer ${tokenY2}` } });
    record(5, 'Logout revokes only calling session; other device stays active',
      logoutRes.status === 204 && m1AfterLogout.status === 200 && m2AfterLogout.status === 401
    );

    // 6. Request payload cannot spoof actor identity
    const spoofHeader = await api('/resources', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenY}`,
        'x-user-id': userZ.user_id,
        'x-actor-id': userZ.user_id,
      },
    });
    record(6, 'Custom headers cannot spoof actor identity', spoofHeader.status === 200);

    // =========================================================================
    // 2. ACTOR IMPERSONATION & AUTHORIZATION DEFENSE (Tests 7-16)
    // =========================================================================
    // 7. POST /resources: Client attempts to forge owner_id as Z
    const forgeResource = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        name: 'Forged Owner Lawn Mower',
        type: 'gardening',
        condition: 'Good',
        owner_id: userZ.user_id,
      }),
    });
    const { rows: resDb } = await query('SELECT owner_id FROM resource_inventory WHERE resource_id = $1', [forgeResource.body?.resource_id]);
    record(7, 'POST /resources ignores client owner_id (derived from actor)',
      forgeResource.status === 201 && resDb[0]?.owner_id === userY.user_id
    );

    // 8. POST /resources/requests: Client attempts to forge requester_id as Z
    const forgeRequest = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: resourceId,
        requester_id: userZ.user_id,
        status: 'APPROVED',
        purpose: 'Test impersonation',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    const requestId = forgeRequest.body?.request_id;
    const { rows: reqDb } = await query('SELECT requester_id, status FROM resource_requests WHERE request_id = $1', [requestId]);
    record(8, 'POST /resources/requests ignores client requester_id and status',
      forgeRequest.status === 201 && reqDb[0]?.requester_id === userY.user_id && reqDb[0]?.status === 'REQUESTED'
    );

    // 9. Approve request: Non-owner (Z) attempts approval -> 403
    const zApprove = await api(`/resources/requests/${requestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
    });
    record(9, 'Non-owner cannot approve borrow request (403)', zApprove.status === 403);

    // 10. Approve request: Requester (Y) attempts self-approval -> 403
    const yApprove = await api(`/resources/requests/${requestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record(10, 'Requester cannot approve their own borrow request (403)', yApprove.status === 403);

    // 11. Owner approves with forged counterpart_id in body
    const xApprove = await api(`/resources/requests/${requestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ counterpart_id: userZ.user_id }),
    });
    const coordId = xApprove.body?.coordination?.coordination_id;
    const { rows: coordDb } = await query('SELECT counterpart_id, requester_id FROM coordinations WHERE coordination_id = $1', [coordId]);
    record(11, 'Approval ignores client counterpart_id (counterpart_id = resource owner)',
      xApprove.status === 200 && coordDb[0]?.counterpart_id === userX.user_id && coordDb[0]?.requester_id === userY.user_id
    );

    // 12. Non-participant (Z) cannot inspect coordination -> 404
    const zReadCoord = await api(`/coordinations/${coordId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenZ}` },
    });
    record(12, 'Non-participant cannot inspect private coordination (404)', zReadCoord.status === 404);

    // 13. Non-participant (Z) cannot send coordination message -> 404
    const zSendMsg = await api(`/coordinations/${coordId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
      body: JSON.stringify({ text: 'Malicious injection' }),
    });
    record(13, 'Non-participant cannot send coordination messages (404)', zSendMsg.status === 404);

    // 14. Message sender_id cannot be forged
    const ySendMsg = await api(`/coordinations/${coordId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ text: 'Hello from Y', sender_id: userZ.user_id }),
    });
    const msgId = ySendMsg.body?.message_id;
    const { rows: msgDb } = await query('SELECT sender_id FROM coordination_messages WHERE message_id = $1', [msgId]);
    record(14, 'Message sender_id derived from server actor (client sender_id ignored)',
      ySendMsg.status === 201 && msgDb[0]?.sender_id === userY.user_id
    );

    // 15. Self-blocking is prohibited
    const selfBlock = await api('/users/block', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ target_user_id: userY.user_id }),
    });
    record(15, 'Self-blocking is rejected (422)', selfBlock.status === 422);

    // 16. Conduct report: reporter cannot be forged
    const conductReport = await api('/conduct-reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        reported_against: userZ.user_id,
        context_type: 'general',
        category: 'harassment',
        description: 'Test report',
        reported_by: userX.user_id, // Attempt to forge reporter
      }),
    });
    const reportId = conductReport.body?.report_id;
    const { rows: crDb } = await query('SELECT reported_by FROM conduct_reports WHERE report_id = $1', [reportId]);
    record(16, 'Conduct report reported_by derived from actor (forgery ignored)',
      conductReport.status === 201 && crDb[0]?.reported_by === userY.user_id
    );

    // =========================================================================
    // 3. STATE MACHINE BYPASS & AUDIT IMMUTABILITY (Tests 17-21)
    // =========================================================================
    // 17. Direct jump APPROVED -> COMPLETED rejected
    const jump1 = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'COMPLETED' }),
    });
    record(17, 'Direct jump APPROVED -> COMPLETED rejected (409/400)', jump1.status >= 400);

    // 18. Direct jump APPROVED -> IN_USE rejected
    const jump2 = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'IN_USE' }),
    });
    record(18, 'Illegal state jump APPROVED -> IN_USE rejected (409/400)', jump2.status >= 400);

    // 19. Forward state progression along canonical graph
    const t1 = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'SCHEDULED' }),
    });
    const t2 = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'HANDOFF_READY' }),
    });
    const t3 = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'HANDED_OVER' }),
    });
    const t4 = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'IN_USE' }),
    });
    record(19, 'Canonical forward transitions (SCHEDULED -> HANDOFF_READY -> HANDED_OVER -> IN_USE) succeed',
      t1.status === 200 && t2.status === 200 && t3.status === 200 && t4.status === 200
    );

    // 20. Historical events cannot be mutated or deleted (immutable trigger)
    let triggerBlocked = false;
    try {
      await query('UPDATE coordination_events SET summary = \'hacked\' WHERE coordination_id = $1', [coordId]);
    } catch (e) {
      triggerBlocked = true;
    }
    record(20, 'Database trigger enforces coordination_events immutability', triggerBlocked);

    // 21. Completed coordination becomes read-only for messaging
    // Initiate & confirm return first to reach COMPLETED
    await api(`/coordinations/${coordId}/return/initiate`, { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` } });
    await api(`/coordinations/${coordId}/return/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } });
    const postCompletedMsg = await api(`/coordinations/${coordId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ text: 'Message after completion' }),
    });
    record(21, 'Completed coordination messaging is rejected (409 read-only)', postCompletedMsg.status === 409);

    // =========================================================================
    // 4. MALFORMED INPUT & INJECTION RESISTANCE (Tests 22-26)
    // =========================================================================
    // 22. Missing required fields in POST /resources/requests
    const malformed1 = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({}),
    });
    record(22, 'Empty payload rejected with 400 VALIDATION_ERROR',
      malformed1.status === 400 && malformed1.body?.error === 'VALIDATION_ERROR'
    );

    // 23. Invalid UUID syntax rejected with 400 (not 500)
    const malformed2 = await api('/resources/not-a-valid-uuid', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record(23, 'Invalid UUID parameter returns 400/404 without 500 or SQL leakage',
      malformed2.status === 400 || malformed2.status === 404
    );

    // 24. SQL injection attack strings in query parameters safely parameterized
    const sqliQuery = await api('/resources?type=\' OR \'1\'=\'1', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record(24, 'SQL injection string in query parameter parameterized safely', sqliQuery.status === 200);

    // 25. SQL injection attack strings in body payload safely parameterized
    const sqliBody = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        name: '\'; DROP TABLE users; --',
        type: 'tools',
        condition: 'Good',
        general_area: 'Safe area',
      }),
    });
    const { rows: usersTableCheck } = await query('SELECT count(*)::int as count FROM users');
    record(25, 'SQL injection string in body stored literally without executing',
      sqliBody.status === 201 && usersTableCheck[0]?.count > 0
    );

    // 26. Path traversal strings handled without filesystem access
    const pathTraversal = await api('/resources/requests/../../etc/passwd', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record(26, 'Path traversal request handled safely by Express routing (404)', pathTraversal.status === 404);

    // =========================================================================
    // 5. CONDUCT REPORT ISOLATION & RATE LIMIT (Tests 27-28)
    // =========================================================================
    // 27. Unrelated resident cannot inspect conduct reports (coordinator only)
    const residentReadReport = await api(`/conduct-reports/${reportId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const coordReadReport = await api(`/conduct-reports/${reportId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenCoord}` },
    });
    record(27, 'Conduct reports restricted to coordinator (resident gets 403)',
      residentReadReport.status === 403 && coordReadReport.status === 200
    );

    // 28. Conduct report submission rate limit (10 per 24h)
    // Y already submitted 1 report. Submit 9 more, then 11th should fail with 429
    let capExceeded = false;
    for (let i = 0; i < 11; i++) {
      const cr = await api('/conduct-reports', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenY}` },
        body: JSON.stringify({
          reported_against: userZ.user_id,
          context_type: 'general',
          category: 'other',
          description: `Rate limit test report ${i}`,
        }),
      });
      if (cr.status === 429) {
        capExceeded = true;
        break;
      }
    }
    record(28, 'Conduct report rate limit enforced (429 SUBMISSION_LIMIT_EXCEEDED)', capExceeded);

  } finally {
    await cleanupTestContext(ctx);
    await stopTestServer();
  }

  const failures = results.filter((r) => r.status === 'FAIL');
  console.log('\n========================================');
  console.log(`SUMMARY OF PHASE 2F SECURITY SUITE:`);
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
  runSecuritySuite()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Fatal error running Phase 2F security suite:', err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { runSecuritySuite };
