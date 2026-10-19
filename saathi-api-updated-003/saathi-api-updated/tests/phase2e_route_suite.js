/**
 * SAATHI Phase 2E Dedicated API Route Verification Suite
 *
 * Verifies the HTTP/API boundary:
 *  - Authentication enforcement
 *  - Input impersonation prevention
 *  - Route privacy & zero data leakage
 *  - State manipulation & transition protection
 *  - Hub isolation
 *  - Blocking semantics & active possession preservation
 *  - Two-party return handshake
 *  - Route collision defense & deterministic dispatch
 *  - Query parameter & standard error envelope validation
 */

require('dotenv').config();
const { pool, query } = require('../src/db');
const {
  startTestServer,
  stopTestServer,
  setupTestContext,
  cleanupTestContext,
} = require('./test_helper');

async function runPhase2ERouteSuite() {
  console.log('========================================================');
  console.log('STARTING SAATHI PHASE 2E API ROUTE VERIFICATION SUITE');
  console.log('========================================================\n');

  const { baseUrl } = await startTestServer();
  const ctx = await setupTestContext();
  const results = [];

  function record(id, title, pass, details = '') {
    results.push({ id, title, status: pass ? 'PASS' : 'FAIL', details });
    console.log(`[Test ${id.toString().padStart(2, '0')}] ${title}: ${pass ? 'PASS' : 'FAIL'}${details ? ' - ' + details : ''}`);
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

    // --- SETUP: Create a test resource owned by X in Hub A ---
    const resCreate = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        name: 'Phase 2E Makita Circular Saw',
        type: 'tools',
        condition: 'Excellent',
        general_area: 'North Commons · Zone 1',
        handoff_policy: 'Community Exchange at Courtyard',
        location: 'Private Garage Cabinet 3', // Private location - must never leak
      }),
    });
    const resourceId = resCreate.body?.resource_id;

    // =========================================================================
    // 1. AUTHENTICATION (Tests 1-3)
    // =========================================================================
    const auth1 = await api('/resources/requests', {
      method: 'POST',
      body: JSON.stringify({ resource_id: resourceId }),
    });
    record(1, 'Anonymous resource request rejected (401)', auth1.status === 401 && auth1.body?.error === 'UNAUTHENTICATED');

    const auth2 = await api('/coordinations', { method: 'GET' });
    record(2, 'Anonymous Coordination access rejected (401)', auth2.status === 401 && auth2.body?.error === 'UNAUTHENTICATED');

    const auth3 = await api(`/users/${userX.user_id}`, { method: 'GET' });
    record(3, 'Anonymous user lookup rejected (401)', auth3.status === 401 && auth3.body?.error === 'UNAUTHENTICATED');

    // =========================================================================
    // 2. INPUT IMPERSONATION (Tests 4-7)
    // =========================================================================
    // Client attempts to supply forged requester_id, owner_id, status in POST /resources/requests
    const reqCreateForged = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: resourceId,
        requester_id: userZ.user_id, // Attempt to forge requester as Z
        owner_id: userZ.user_id,     // Attempt to forge owner
        counterpart_id: userZ.user_id,
        hub_id: hubB,
        status: 'APPROVED',          // Attempt to bypass approval
        purpose: 'Deck building project',
        duration: '3 hours',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 14400000).toISOString(),
      }),
    });
    const requestId = reqCreateForged.body?.request_id;
    // Verify in database that requester_id is actually Y (authenticated actor), status is REQUESTED
    const { rows: verifyReq } = await query('SELECT requester_id, status FROM resource_requests WHERE request_id = $1', [requestId]);
    record(4, 'Forged requester_id/status in request body ignored',
      reqCreateForged.status === 201 &&
      verifyReq[0]?.requester_id === userY.user_id &&
      verifyReq[0]?.status === 'REQUESTED'
    );

    // Client attempts to supply forged owner_id and hub_id in POST /resources
    const resCreateForged = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        name: 'Forged Ownership Ladder',
        type: 'tools',
        condition: 'Good',
        owner_id: userX.user_id, // Attempt to forge owner as X
        hub_id: hubB,            // Attempt to forge hub as Hub B
      }),
    });
    const ladderId = resCreateForged.body?.resource_id;
    const { rows: verifyRes } = await query('SELECT owner_id, hub_id FROM resource_inventory WHERE resource_id = $1', [ladderId]);
    record(5, 'Forged owner_id/hub_id in POST /resources ignored',
      resCreateForged.status === 201 &&
      verifyRes[0]?.owner_id === userY.user_id &&
      verifyRes[0]?.hub_id === hubA
    );

    // Client attempts to supply forged counterpart_id / requester_id in approval
    const approveForged = await api(`/resources/requests/${requestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        counterpart_id: userZ.user_id, // Attempt to forge counterpart
        requester_id: userZ.user_id,   // Attempt to forge borrower
        state: 'COMPLETED',            // Attempt to skip states
      }),
    });
    const coordId = approveForged.body?.coordination?.coordination_id;
    const { rows: verifyCoord } = await query('SELECT requester_id, counterpart_id, state FROM coordinations WHERE coordination_id = $1', [coordId]);
    record(6, 'Forged counterpart_id in approval ignored',
      approveForged.status === 200 &&
      verifyCoord[0]?.counterpart_id === userX.user_id &&
      verifyCoord[0]?.requester_id === userY.user_id &&
      verifyCoord[0]?.state === 'APPROVED'
    );

    // Query parameter override attempt: ?user_id=... or ?hub_id=...
    const coordQuerySpoof = await api(`/coordinations?user_id=${userZ.user_id}&hub_id=${hubB}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    // Y should see their own coordinations, not Z's, and in Hub A
    const yCanSeeCoord = coordQuerySpoof.body?.some((c) => c.coordination_id === coordId);
    record(7, 'Query parameter actor/hub spoofing ignored', coordQuerySpoof.status === 200 && yCanSeeCoord);

    // =========================================================================
    // 3. ROUTE PRIVACY (Tests 8-11)
    // =========================================================================
    // Public resource discovery (GET /resources and GET /resources/:id)
    const pubList = await api('/resources', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const pubDetail = await api(`/resources/${resourceId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const foundResource = pubList.body?.find((r) => r.resource_id === resourceId);
    const hasOwnerLeak = 'owner_id' in (foundResource || {}) || 'owner_name' in (foundResource || {}) ||
                         'owner_phone' in (foundResource || {}) || 'location' in (foundResource || {});
    const hasDetailLeak = 'owner_id' in (pubDetail.body || {}) || 'location' in (pubDetail.body || {});
    record(8, 'Public resource discovery contains zero owner/storage leakage', !hasOwnerLeak && !hasDetailLeak);

    // Outbound request privacy (GET /resources/requests/outbound)
    const outList = await api('/resources/requests/outbound', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const reqItem = outList.body?.find((r) => r.request_id === requestId);
    const hasReqOwnerLeak = 'owner_id' in (reqItem || {}) || 'owner_phone' in (reqItem || {});
    record(9, 'Outbound request view contains zero private owner contact leakage', !hasReqOwnerLeak);

    // Coordination detail privacy (GET /coordinations/:id)
    const coordDetail = await api(`/coordinations/${coordId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const hasPrivateAddressLeak = JSON.stringify(coordDetail.body).includes('Private Garage Cabinet 3');
    record(10, 'Coordination detail contains zero private storage/address leakage', !hasPrivateAddressLeak);

    // User lookup privacy (GET /users/:userId)
    const selfUser = await api(`/users/${userX.user_id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    const counterpartUser = await api(`/users/${userX.user_id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const unrelatedUserLookup = await api(`/users/${userX.user_id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenZ}` },
    });
    const noPasswordSelf = selfUser.body?.password_hash === undefined;
    const minimalCounterpart = counterpartUser.body?.password_hash === undefined &&
                               counterpartUser.body?.email === undefined &&
                               counterpartUser.body?.name !== undefined;
    const unrelated404 = unrelatedUserLookup.status === 404;
    record(11, 'User lookup scrubs password_hash and protects non-counterparts (404)',
      noPasswordSelf && minimalCounterpart && unrelated404
    );

    // =========================================================================
    // 4. STATE MANIPULATION (Tests 12-14)
    // =========================================================================
    // Direct jump from APPROVED to COMPLETED
    const jumpCompleted = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'COMPLETED' }),
    });
    record(12, 'Direct jump APPROVED -> COMPLETED rejected', jumpCompleted.status >= 400);

    // Invalid jumps: APPROVED -> IN_USE, SCHEDULED -> COMPLETED, etc.
    const jumpInUse = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'IN_USE' }),
    });
    record(13, 'Invalid transition APPROVED -> IN_USE rejected', jumpInUse.status >= 400);

    // Forged participant: Unrelated user Z attempts transition
    const attackerTransition = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
      body: JSON.stringify({ to_state: 'SCHEDULED' }),
    });
    record(14, 'Unrelated user cannot transition coordination (404)', attackerTransition.status === 404);

    // =========================================================================
    // 5. HUB ISOLATION (Tests 15-18)
    // =========================================================================
    // Cross-hub resource read
    const crossResRead = await api(`/resources/${resourceId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenCross}` },
    });
    record(15, 'Cross-hub resource read rejected (404)', crossResRead.status === 404);

    // Cross-hub request creation
    const crossReq = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCross}` },
      body: JSON.stringify({
        resource_id: resourceId,
        purpose: 'Cross-hub attempt',
        duration: '1h',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    record(16, 'Cross-hub request creation rejected (404)', crossReq.status === 404);

    // Cross-hub coordination read
    const crossCoordRead = await api(`/coordinations/${coordId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenCross}` },
    });
    record(17, 'Cross-hub coordination read rejected (404)', crossCoordRead.status === 404);

    // Cross-hub user lookup
    const crossUserRead = await api(`/users/${userX.user_id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenCross}` },
    });
    record(18, 'Cross-hub user lookup rejected (404)', crossUserRead.status === 404);

    // =========================================================================
    // 6. BLOCKING (Tests 19-22)
    // =========================================================================
    // Progress coordId through canonical states to IN_USE first:
    // APPROVED -> SCHEDULED (Owner or Borrower)
    await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'SCHEDULED' }),
    });
    // SCHEDULED -> HANDOFF_READY (Owner)
    await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'HANDOFF_READY' }),
    });
    // HANDOFF_READY -> HANDED_OVER (Borrower or Owner)
    await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'HANDED_OVER' }),
    });
    // HANDED_OVER -> IN_USE (Borrower)
    await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'IN_USE' }),
    });

    // Create a 2nd resource owned by X to test blocked discovery & requests
    const res2 = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        name: 'Phase 2E Makita Blower',
        type: 'gardening',
        condition: 'Good',
        general_area: 'North Commons',
      }),
    });
    const res2Id = res2.body?.resource_id;

    // X blocks Y
    const blockRes = await api('/users/block', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ target_user_id: userY.user_id }),
    });
    record(19, 'Block relationship established', blockRes.status === 201 && blockRes.body?.status === 'BLOCKED');

    // Blocked discovery: Y browses resources; res2Id must NOT appear
    const yDiscAfterBlock = await api('/resources', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const foundRes2 = yDiscAfterBlock.body?.some((r) => r.resource_id === res2Id);
    record(20, 'Blocked user cannot discover blocker resources', !foundRes2);

    // Blocked request: Y attempts to request res2Id -> 404
    const yReqAfterBlock = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: res2Id,
        purpose: 'Attempted borrow after block',
        duration: '1h',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    record(21, 'Blocked user cannot request blocker resource (404)', yReqAfterBlock.status === 404);

    // Blocked message: Y attempts to message on coordId -> 403
    const yMsgAfterBlock = await api(`/coordinations/${coordId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ text: 'Hello post block' }),
    });
    record(22, 'Messaging prohibited post-block (403)', yMsgAfterBlock.status === 403);

    // =========================================================================
    // 7. RETURN HANDSHAKE (Tests 23-27)
    // =========================================================================
    // Active possession preserved: coordId is visible under SAFETY tab
    const safetyTab = await api('/coordinations?tab=SAFETY', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const preservedInSafety = safetyTab.body?.some((c) => c.coordination_id === coordId);
    record(23, 'Active physical coordination preserved under SAFETY tab', preservedInSafety);

    // Return Step 1: Owner attempts to initiate return -> FORBIDDEN (borrower only)
    const ownerInitReturn = await api(`/coordinations/${coordId}/return/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(24, 'Owner cannot initiate return (403)', ownerInitReturn.status === 403);

    // Return Step 2: Borrower initiates return -> RETURN_PENDING
    const borrowerInitReturn = await api(`/coordinations/${coordId}/return/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record(25, 'Borrower can initiate return (state -> RETURN_PENDING)',
      borrowerInitReturn.status === 200 && borrowerInitReturn.body?.state === 'RETURN_PENDING'
    );

    // Return Step 3: Borrower attempts to confirm return -> FORBIDDEN (owner only)
    const borrowerConfirmReturn = await api(`/coordinations/${coordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record(26, 'Borrower cannot confirm return (403)', borrowerConfirmReturn.status === 403);

    // Return Step 4: Owner confirms return -> COMPLETED & resource availability restored
    const ownerConfirmReturn = await api(`/coordinations/${coordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    // Check resource availability in discovery for X
    const xDisc = await api('/resources', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    const restoredResource = xDisc.body?.find((r) => r.resource_id === resourceId);
    record(27, 'Owner confirms return (state -> COMPLETED, resource available restored)',
      ownerConfirmReturn.status === 200 &&
      ownerConfirmReturn.body?.state === 'COMPLETED' &&
      restoredResource?.available === true
    );

    // =========================================================================
    // 8. ROUTE COLLISIONS (Tests 28-31)
    // =========================================================================
    // 28. GET /resources/requests/inbound is not captured by /resources/:id
    const inboundCheck = await api('/resources/requests/inbound', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(28, 'GET /resources/requests/inbound does not collide with /resources/:id',
      inboundCheck.status === 200 && Array.isArray(inboundCheck.body)
    );

    // 29. GET /resources/requests/outbound is not captured by /resources/:id
    const outboundCheck = await api('/resources/requests/outbound', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(29, 'GET /resources/requests/outbound does not collide with /resources/:id',
      outboundCheck.status === 200 && Array.isArray(outboundCheck.body)
    );

    // 30. GET /resources/requests/:id is not captured by /resources/:id
    const requestDetailCheck = await api(`/resources/requests/${requestId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(30, 'GET /resources/requests/:id does not collide with /resources/:id',
      requestDetailCheck.status === 200 && requestDetailCheck.body?.request_id === requestId
    );

    // 31. GET /users/blocked is not captured by /users/:userId
    const blockedRouteCheck = await api('/users/blocked', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(31, 'GET /users/blocked does not collide with /users/:userId',
      blockedRouteCheck.status === 200 && Array.isArray(blockedRouteCheck.body)
    );

    // =========================================================================
    // 9. QUERY PARAMETER & ERROR ENVELOPE VALIDATION (Tests 32-33)
    // =========================================================================
    // 32. Validate tab query parameter allowlist in GET /coordinations
    const invalidTabCheck = await api('/coordinations?tab=MALICIOUS_TAB', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(32, 'Invalid tab query parameter rejected with 400 VALIDATION_ERROR',
      invalidTabCheck.status === 400 && invalidTabCheck.body?.error === 'VALIDATION_ERROR'
    );

    // 33. Error response envelope format complies with API_CONTRACT.md Section 18
    const errorEnvelopeValid = invalidTabCheck.body &&
      typeof invalidTabCheck.body.error === 'string' &&
      typeof invalidTabCheck.body.message === 'string' &&
      typeof invalidTabCheck.body.status === 'number';
    record(33, 'Standard error envelope matches contract ({ error, message, status })', errorEnvelopeValid);

  } finally {
    await cleanupTestContext(ctx);
    await stopTestServer();
  }

  const failures = results.filter((r) => r.status === 'FAIL');
  console.log('\n========================================');
  console.log(`SUMMARY OF PHASE 2E ROUTE TESTS:`);
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
  runPhase2ERouteSuite()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Fatal error running Phase 2E route suite:', err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { runPhase2ERouteSuite };
