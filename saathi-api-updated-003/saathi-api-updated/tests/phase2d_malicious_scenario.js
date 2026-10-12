/**
 * SAATHI Phase 2D Malicious Scenario Integration Test (Step 25)
 *
 * Deterministic test using three users:
 *   X = Resource Owner
 *   Y = Legitimate Requester / Borrower
 *   Z = Unrelated Malicious User
 *
 * Scenario:
 *  1. X owns a drill.
 *  2. Y discovers the drill without seeing X's identity/location in public discovery.
 *  3. Y requests the drill.
 *  4. X sees Y's owner-review information (factual trust signals only).
 *  5. X approves.
 *  6. Coordination is created.
 *  7. Verify: counterpart_id = X, requester_id = Y.
 *  8. Z attempts to:
 *     - discover X's resource owner information
 *     - approve Y's request
 *     - read the Coordination
 *     - read Coordination messages
 *     - initiate return
 *     - confirm return
 *  9. Every unauthorized action by Z must fail safely (403 or 404).
 * 10. Y initiates return.
 * 11. Coordination becomes RETURN_PENDING.
 * 12. X confirms return.
 * 13. Coordination becomes COMPLETED.
 * 14. Resource becomes available.
 * 15. Verify historical Coordination remains intact.
 * 16. Create another active coordination between X and Y.
 * 17. X blocks Y.
 * 18. Verify Y cannot create new interactions with X (cannot discover resources, cannot request).
 * 19. Verify active coordination remains recoverable under SAFETY tab.
 * 20. Verify return can still complete (Y initiates -> RETURN_PENDING, X confirms -> COMPLETED).
 */

require('dotenv').config();
const assert = require('assert');
const {
  startTestServer,
  stopTestServer,
  setupTestContext,
  cleanupTestContext,
} = require('./test_helper');

async function runMaliciousScenario() {
  console.log('====================================================');
  console.log('STARTING SAATHI PHASE 2D MALICIOUS SCENARIO (STEP 25)');
  console.log('====================================================\n');

  const { baseUrl } = await startTestServer();
  const ctx = await setupTestContext();
  const stepResults = [];

  function logStep(stepNum, title, pass, details = '') {
    stepResults.push({ stepNum, title, pass, details });
    const mark = pass ? '✓ PASS' : '✗ FAIL';
    console.log(`[Step ${stepNum.toString().padStart(2, '0')}] ${title}: ${mark}${details ? ' (' + details + ')' : ''}`);
    if (!pass) {
      throw new Error(`Step ${stepNum} failed: ${title} - ${details}`);
    }
  }

  try {
    const { tokenX, tokenY, tokenZ } = ctx.tokens;
    const { userX, userY, userZ } = ctx.users;

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

    // -------------------------------------------------------------------------
    // Step 1: X owns a drill
    // -------------------------------------------------------------------------
    const resCreate = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        name: 'DeWalt 20V Max Cordless Drill',
        type: 'tools',
        condition: 'Excellent',
        general_area: 'Greenwood Commons · West Quadrant',
        handoff_policy: 'Safe/mutually agreed handoff at Community Exchange',
        location: 'Private Apt 4B, 123 Secret Lane, Phone: 555-0199',
      }),
    });
    const drillId = resCreate.body?.resource_id;
    logStep(1, "X creates and owns a drill", resCreate.status === 201 && Boolean(drillId), `drill_id: ${drillId}`);

    // -------------------------------------------------------------------------
    // Step 2: Y discovers the drill without seeing X's identity or private location
    // -------------------------------------------------------------------------
    const disc = await api('/resources', {
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const drillFound = disc.body?.find((r) => r.resource_id === drillId);
    const zeroLeakage = drillFound &&
      drillFound.owner_id === undefined &&
      drillFound.owner_name === undefined &&
      drillFound.owner_phone === undefined &&
      drillFound.location === undefined &&
      drillFound.general_area === 'Greenwood Commons · West Quadrant';
    logStep(2, "Y discovers drill with zero owner/location leakage", disc.status === 200 && Boolean(zeroLeakage));

    // -------------------------------------------------------------------------
    // Step 3: Y requests the drill
    // -------------------------------------------------------------------------
    const reqStart = new Date(Date.now() + 3600000).toISOString();
    const reqEnd = new Date(Date.now() + 7200000).toISOString();
    const reqCreate = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: drillId,
        purpose: 'Hanging wall shelves in apartment',
        duration: '2 hours',
        time_window_start: reqStart,
        time_window_end: reqEnd,
        handoff_preference: 'Community Exchange',
        message: 'Can pick up anytime today afternoon',
      }),
    });
    const requestId = reqCreate.body?.request_id;
    logStep(3, "Y requests the drill", reqCreate.status === 201 && Boolean(requestId), `request_id: ${requestId}`);

    // -------------------------------------------------------------------------
    // Step 4: X sees Y's owner-review information with factual trust signals
    // -------------------------------------------------------------------------
    const inbound = await api('/resources/requests/inbound', {
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    const inboundReq = inbound.body?.find((r) => r.request_id === requestId);
    const hasTrustSignals = inboundReq &&
      inboundReq.requester_id === userY.user_id &&
      inboundReq.requester_trust &&
      typeof inboundReq.requester_trust.identity_verified === 'boolean' &&
      typeof inboundReq.requester_trust.neighborhood_verified === 'boolean' &&
      typeof inboundReq.requester_trust.membership_age === 'string' &&
      inboundReq.requester_trust.score === undefined &&
      inboundReq.requester_trust.rating === undefined;
    logStep(4, "X sees Y's owner-review with factual trust signals only", inbound.status === 200 && Boolean(hasTrustSignals));

    // -------------------------------------------------------------------------
    // Step 5: X approves request
    // -------------------------------------------------------------------------
    const approveRes = await api(`/resources/requests/${requestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    logStep(5, "X approves Y's request", approveRes.status === 200 && (approveRes.body?.status === 'APPROVED' || approveRes.body?.request?.status === 'APPROVED'));

    // -------------------------------------------------------------------------
    // Step 6: Coordination is created
    // -------------------------------------------------------------------------
    const coordination = approveRes.body?.coordination;
    const coordinationId = coordination?.coordination_id;
    logStep(6, "Coordination is created upon approval", Boolean(coordinationId), `coordination_id: ${coordinationId}`);

    // -------------------------------------------------------------------------
    // Step 7: Verify counterpart_id = X and requester_id = Y
    // -------------------------------------------------------------------------
    const correctParticipants = coordination &&
      coordination.counterpart_id === userX.user_id &&
      coordination.requester_id === userY.user_id;
    logStep(7, "Verify counterpart_id = X (owner) and requester_id = Y (borrower)", Boolean(correctParticipants));

    // -------------------------------------------------------------------------
    // Step 8 & 9: Z attacks the workflow and all attempts fail safely
    // -------------------------------------------------------------------------
    // 8a. Z attempts to discover X's resource owner information
    const zDisc = await api(`/resources/${drillId}`, {
      headers: { Authorization: `Bearer ${tokenZ}` },
    });
    const zLeakedOwner = zDisc.body?.owner_id !== undefined || zDisc.body?.location !== undefined;

    // 8b. Z attempts to approve Y's request (already approved or any request)
    const zApprove = await api(`/resources/requests/${requestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
    });

    // 8c. Z attempts to read the Coordination
    const zReadCoord = await api(`/coordinations/${coordinationId}`, {
      headers: { Authorization: `Bearer ${tokenZ}` },
    });

    // 8d. Z attempts to read Coordination messages
    const zReadMsgs = await api(`/coordinations/${coordinationId}/messages`, {
      headers: { Authorization: `Bearer ${tokenZ}` },
    });

    // 8e. Z attempts to initiate return
    const zInitReturn = await api(`/coordinations/${coordinationId}/return/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
    });

    // 8f. Z attempts to confirm return
    const zConfReturn = await api(`/coordinations/${coordinationId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
    });

    const zAllFailed = !zLeakedOwner &&
      [400, 403, 404, 409].includes(zApprove.status) &&
      zReadCoord.status === 404 &&
      zReadMsgs.status === 404 &&
      [403, 404].includes(zInitReturn.status) &&
      [403, 404].includes(zConfReturn.status);

    logStep(8, "Z attempts multiple malicious interventions against X & Y", true);
    logStep(9, "Every unauthorized action by Z fails safely with 403 or 404", zAllFailed,
      `approve:${zApprove.status}, read:${zReadCoord.status}, msgs:${zReadMsgs.status}, init:${zInitReturn.status}, conf:${zConfReturn.status}`);

    // Progress coordination through lifecycle: APPROVED -> SCHEDULED -> HANDOFF_READY -> HANDED_OVER -> IN_USE
    await api(`/coordinations/${coordinationId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'SCHEDULED' }),
    });
    await api(`/coordinations/${coordinationId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'HANDOFF_READY' }),
    });
    await api(`/coordinations/${coordinationId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'HANDED_OVER' }),
    });
    await api(`/coordinations/${coordinationId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'IN_USE' }),
    });

    // -------------------------------------------------------------------------
    // Step 10: Y initiates return
    // -------------------------------------------------------------------------
    const yReturnInit = await api(`/coordinations/${coordinationId}/return/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    logStep(10, "Y initiates return", yReturnInit.status === 200);

    // -------------------------------------------------------------------------
    // Step 11: Coordination becomes RETURN_PENDING
    // -------------------------------------------------------------------------
    const isReturnPending = yReturnInit.body?.state === 'RETURN_PENDING' &&
      yReturnInit.body?.borrower_return_initiated === true;
    logStep(11, "Coordination state becomes RETURN_PENDING", Boolean(isReturnPending));

    // Verify Y cannot confirm owner receipt
    const yFalseConf = await api(`/coordinations/${coordinationId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    assert.strictEqual(yFalseConf.status, 403, "Borrower cannot self-confirm owner return");

    // -------------------------------------------------------------------------
    // Step 12: X confirms return
    // -------------------------------------------------------------------------
    const xReturnConf = await api(`/coordinations/${coordinationId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    logStep(12, "X confirms return receipt", xReturnConf.status === 200);

    // -------------------------------------------------------------------------
    // Step 13: Coordination becomes COMPLETED
    // -------------------------------------------------------------------------
    const isCompleted = xReturnConf.body?.state === 'COMPLETED' &&
      xReturnConf.body?.owner_return_confirmed === true &&
      Boolean(xReturnConf.body?.completed_at);
    logStep(13, "Coordination state becomes COMPLETED", Boolean(isCompleted));

    // -------------------------------------------------------------------------
    // Step 14: Resource becomes available again
    // -------------------------------------------------------------------------
    const discAfterReturn = await api('/resources', {
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const drillAfter = discAfterReturn.body?.find((r) => r.resource_id === drillId);
    logStep(14, "Resource becomes available in discovery again", drillAfter && drillAfter.available === true);

    // -------------------------------------------------------------------------
    // Step 15: Verify historical Coordination remains intact
    // -------------------------------------------------------------------------
    const yHistory = await api(`/coordinations/${coordinationId}`, {
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const historyIntact = yHistory.status === 200 &&
      yHistory.body?.state === 'COMPLETED' &&
      yHistory.body?.events?.length >= 5;
    logStep(15, "Historical Coordination remains intact with immutable events", Boolean(historyIntact),
      `events: ${yHistory.body?.events?.length}`);

    // -------------------------------------------------------------------------
    // Step 16: Create another active coordination between X and Y
    // -------------------------------------------------------------------------
    const req2Create = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: drillId,
        purpose: 'Second project: building bookshelf',
        duration: '1 day',
        time_window_start: reqStart,
        time_window_end: reqEnd,
      }),
    });
    const req2Id = req2Create.body?.request_id;
    const approve2 = await api(`/resources/requests/${req2Id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    const coord2Id = approve2.body?.coordination?.coordination_id;

    // Transition coord2 to IN_USE (physical possession with Y)
    await api(`/coordinations/${coord2Id}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'SCHEDULED' }),
    });
    await api(`/coordinations/${coord2Id}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'HANDOFF_READY' }),
    });
    await api(`/coordinations/${coord2Id}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'HANDED_OVER' }),
    });
    await api(`/coordinations/${coord2Id}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'IN_USE' }),
    });
    logStep(16, "Second coordination created and active (IN_USE)", Boolean(coord2Id), `coord2_id: ${coord2Id}`);

    // -------------------------------------------------------------------------
    // Step 17: X blocks Y
    // -------------------------------------------------------------------------
    const blockRes = await api('/users/block', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ blocked_user_id: userY.user_id }),
    });
    logStep(17, "X blocks Y", blockRes.status === 201);

    // -------------------------------------------------------------------------
    // Step 18: Verify Y cannot create new interactions with X
    // -------------------------------------------------------------------------
    // Y cannot discover X's drill
    const yBlockedDisc = await api('/resources', {
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const drillSeenByY = yBlockedDisc.body?.some((r) => r.resource_id === drillId);

    // Y cannot create new request on X's drill
    const yNewReq = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: drillId,
        time_window_start: reqStart,
        time_window_end: reqEnd,
      }),
    });

    // Y cannot send messages on active coordination now that they are blocked
    const yBlockedMsg = await api(`/coordinations/${coord2Id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ text: 'Hello post-block message' }),
    });

    const newInteractionsProhibited = !drillSeenByY &&
      [403, 404].includes(yNewReq.status) &&
      yBlockedMsg.status === 403;
    logStep(18, "Y cannot create new interactions with X (discovery, requests, messaging blocked)",
      newInteractionsProhibited, `disc:${!drillSeenByY}, req:${yNewReq.status}, msg:${yBlockedMsg.status}`);

    // -------------------------------------------------------------------------
    // Step 19: Verify active coordination remains recoverable under SAFETY tab
    // -------------------------------------------------------------------------
    const ySafetyTab = await api('/coordinations?tab=SAFETY', {
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const xSafetyTab = await api('/coordinations?tab=SAFETY', {
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    const inYSafety = ySafetyTab.body?.some((c) => c.coordination_id === coord2Id);
    const inXSafety = xSafetyTab.body?.some((c) => c.coordination_id === coord2Id);
    logStep(19, "Active physical coordination preserved and visible under SAFETY tab", inYSafety && inXSafety);

    // -------------------------------------------------------------------------
    // Step 20: Verify return can still complete safely
    // -------------------------------------------------------------------------
    // Borrower Y initiates return
    const yReturnInitBlocked = await api(`/coordinations/${coord2Id}/return/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    assert.strictEqual(yReturnInitBlocked.status, 200, "Blocked borrower can still initiate return");
    assert.strictEqual(yReturnInitBlocked.body?.state, 'RETURN_PENDING');

    // Owner X confirms return
    const xReturnConfBlocked = await api(`/coordinations/${coord2Id}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    assert.strictEqual(xReturnConfBlocked.status, 200, "Blocked owner can confirm return receipt");
    assert.strictEqual(xReturnConfBlocked.body?.state, 'COMPLETED');
    logStep(20, "Return successfully completed despite blocking", true, "state: COMPLETED");

    console.log('\n====================================================');
    console.log('MALICIOUS SCENARIO COMPLETED SUCCESSFULLY: 20/20 PASS');
    console.log('====================================================\n');
    return { success: true, count: stepResults.length };
  } finally {
    await cleanupTestContext(ctx);
    await stopTestServer();
  }
}

if (require.main === module) {
  runMaliciousScenario()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Malicious Scenario Failed:', err);
      process.exit(1);
    });
}

module.exports = { runMaliciousScenario };
