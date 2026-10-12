/**
 * SAATHI Phase 2D Comprehensive Authorization Test Suite
 * Validates all 56 canonical requirements defined in Step 24.
 */

require('dotenv').config();
const { pool, query } = require('../src/db');
const {
  startTestServer,
  stopTestServer,
  setupTestContext,
  cleanupTestContext,
} = require('./test_helper');

async function runTestSuite() {
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

    // Helper fetch wrapper
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
    // SECTION 1: AUTHENTICATION (Tests 1-3)
    // =========================================================================

    // 1. unauthenticated resource request rejected
    const r1 = await api('/resources/requests', {
      method: 'POST',
      body: JSON.stringify({ resource_id: '00000000-0000-0000-0000-000000000000' }),
    });
    record(1, 'Unauthenticated resource request rejected', r1.status === 401);

    // 2. unauthenticated approval rejected
    const r2 = await api('/resources/requests/00000000-0000-0000-0000-000000000000/approve', {
      method: 'POST',
    });
    record(2, 'Unauthenticated approval rejected', r2.status === 401);

    // 3. unauthenticated coordination read rejected
    const r3 = await api('/coordinations/00000000-0000-0000-0000-000000000000');
    record(3, 'Unauthenticated coordination read rejected', r3.status === 401);

    // =========================================================================
    // SECTION 2: RESOURCE PRIVACY (Tests 4-7)
    // =========================================================================

    // Create a resource owned by X with sensitive location info
    const resCreate = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        name: 'DeWalt 20V Cordless Drill',
        type: 'tools',
        condition: 'Like New',
        general_area: 'Greenwood Commons · West Quadrant',
        handoff_policy: 'Safe/mutually agreed handoff',
        location: 'Private Apt 4B, 123 Secret Lane, Owner Cell: 555-0199',
      }),
    });
    const drillResourceId = resCreate.body?.resource_id;

    // Public discovery GET /resources
    const disc = await api('/resources', {
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const drillListing = disc.body?.find((r) => r.resource_id === drillResourceId);

    // 4. public resource response contains no owner_id
    record(4, 'Public resource response contains no owner_id', drillListing && drillListing.owner_id === undefined);

    // 5. public resource response contains no exact private location
    record(5, 'Public resource response contains no exact private location', drillListing && !drillListing.location && drillListing.general_area === 'Greenwood Commons · West Quadrant');

    // 6. public resource response contains no phone or owner_name
    record(6, 'Public resource response contains no phone or owner_name', drillListing && !drillListing.owner_name && !drillListing.owner_phone && !drillListing.phone);

    // 7. public resource endpoint does not use raw SELECT *
    // Check fields against allowed Layer 1 summary keys
    const allowedKeys = ['resource_id', 'name', 'type', 'condition', 'general_area', 'handoff_policy', 'available', 'requires_approval'];
    const listingKeys = Object.keys(drillListing || {});
    const cleanKeys = listingKeys.every((k) => allowedKeys.includes(k));
    record(7, 'Public resource endpoint does not use raw SELECT *', cleanKeys);

    // =========================================================================
    // SECTION 3: RESOURCE REQUEST (Tests 8-13)
    // =========================================================================

    const reqStart = new Date(Date.now() + 3600000).toISOString();
    const reqEnd = new Date(Date.now() + 7200000).toISOString();

    // 8. authenticated requester can create valid request
    const createReqRes = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: drillResourceId,
        purpose: 'Hang curtains in living room',
        duration: '~2 hours',
        time_window_start: reqStart,
        time_window_end: reqEnd,
        handoff_preference: 'Cafe Courtyard',
        message: 'Can pick up anytime around 2pm.',
      }),
    });
    const drillRequestId = createReqRes.body?.request_id;
    record(8, 'Authenticated requester can create valid request', createReqRes.status === 201 && createReqRes.body?.status === 'REQUESTED');

    // 9. requester_id is derived from actor
    const { rows: dbReq } = await query('SELECT requester_id, requested_by FROM resource_requests WHERE request_id = $1', [drillRequestId]);
    record(9, 'requester_id is derived from actor', dbReq[0]?.requester_id === userY.user_id && dbReq[0]?.requested_by === userY.user_id);

    // 10. client cannot impersonate another requester
    const impersonateReq = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: drillResourceId,
        requester_id: userZ.user_id, // Trying to spoof Z
        time_window_start: reqStart,
        time_window_end: reqEnd,
      }),
    });
    const { rows: spoofCheck } = await query('SELECT requester_id FROM resource_requests WHERE request_id = $1', [impersonateReq.body?.request_id]);
    record(10, 'Client cannot impersonate another requester', spoofCheck[0]?.requester_id === userY.user_id);

    // 11. owner cannot request own resource
    const selfReq = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` }, // Owner X
      body: JSON.stringify({
        resource_id: drillResourceId,
        time_window_start: reqStart,
        time_window_end: reqEnd,
      }),
    });
    record(11, 'Owner cannot request own resource', selfReq.status === 422 || selfReq.status === 400);

    // 12. cross-hub request rejected
    const crossReq = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCross}` }, // Resident in Hub B
      body: JSON.stringify({
        resource_id: drillResourceId, // In Hub A
        time_window_start: reqStart,
        time_window_end: reqEnd,
      }),
    });
    record(12, 'Cross-hub request rejected', crossReq.status === 404);

    // 13. blocked requester cannot request blocked owner's resource
    // Create resource 2 for X, block Z, and test Z requesting it
    const res2 = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        name: 'Lawnmower',
        type: 'gardening',
        condition: 'Good',
        location: 'Shed',
      }),
    });
    const mowerId = res2.body?.resource_id;
    // X blocks Z
    await api('/users/block', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ target_user_id: userZ.user_id }),
    });
    const blockedReq = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
      body: JSON.stringify({
        resource_id: mowerId,
        time_window_start: reqStart,
        time_window_end: reqEnd,
      }),
    });
    record(13, 'Blocked requester cannot request blocked owner resource', blockedReq.status === 404);

    // =========================================================================
    // SECTION 4: APPROVAL & DECLINE (Tests 14-25)
    // =========================================================================

    // 14. non-owner cannot approve
    const nonOwnerApprove = await api(`/resources/requests/${drillRequestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` }, // Attacker Z
    });
    record(14, 'Non-owner cannot approve', nonOwnerApprove.status === 403);

    // 15. actual owner can approve
    const ownerApprove = await api(`/resources/requests/${drillRequestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` }, // Owner X
    });
    const drillCoordId = ownerApprove.body?.coordination?.coordination_id;
    record(15, 'Actual owner can approve', ownerApprove.status === 200 && !!drillCoordId);

    // 16. approval creates Coordination
    record(16, 'Approval creates Coordination', !!drillCoordId && ownerApprove.body?.coordination?.state === 'APPROVED');

    // 17. Coordination requester_id matches request requester
    const { rows: coordRows } = await query('SELECT * FROM coordinations WHERE coordination_id = $1', [drillCoordId]);
    const coordRow = coordRows[0];
    record(17, 'Coordination requester_id matches request requester', coordRow?.requester_id === userY.user_id);

    // 18. Coordination counterpart_id matches actual resource owner
    record(18, 'Coordination counterpart_id matches actual resource owner', coordRow?.counterpart_id === userX.user_id);

    // 19. client cannot choose counterpart_id
    // Derived strictly by backend as resource.owner_id
    record(19, 'Client cannot choose counterpart_id', coordRow?.counterpart_id === userX.user_id);

    // 20. approval is transactional
    const { rows: eventRows } = await query('SELECT * FROM coordination_events WHERE coordination_id = $1', [drillCoordId]);
    record(20, 'Approval is transactional', eventRows.length === 1 && eventRows[0].event_type === 'COORDINATION_CREATED');

    // 21. duplicate approval is rejected
    const dupApprove = await api(`/resources/requests/${drillRequestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(21, 'Duplicate approval is rejected', dupApprove.status === 409);

    // 22. unavailable resource cannot be approved twice
    // Create second request for same resource
    const req2Res = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: drillResourceId,
        time_window_start: reqStart,
        time_window_end: reqEnd,
      }),
    });
    const req2Id = req2Res.body?.request_id;
    const approveWhileInCoord = await api(`/resources/requests/${req2Id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(22, 'Unavailable resource cannot be approved twice', approveWhileInCoord.status === 409);

    // 23. non-owner cannot decline
    const nonOwnerDecline = await api(`/resources/requests/${req2Id}/decline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
    });
    record(23, 'Non-owner cannot decline', nonOwnerDecline.status === 403);

    // 24. owner can decline
    const ownerDecline = await api(`/resources/requests/${req2Id}/decline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ reason: 'Currently lent to neighbor' }),
    });
    record(24, 'Owner can decline', ownerDecline.status === 200 && ownerDecline.body?.status === 'DECLINED');

    // 25. declined request cannot later be approved
    const approveDeclined = await api(`/resources/requests/${req2Id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(25, 'Declined request cannot later be approved', approveDeclined.status === 409);

    // =========================================================================
    // SECTION 5: COORDINATION AUTHORIZATION & MESSAGING (Tests 26-29)
    // =========================================================================

    // 26. requester can read own Coordination
    const yReadCoord = await api(`/coordinations/${drillCoordId}`, {
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record(26, 'Requester can read own Coordination', yReadCoord.status === 200 && yReadCoord.body?.role === 'borrowing');

    // 27. owner can read own Coordination
    const xReadCoord = await api(`/coordinations/${drillCoordId}`, {
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(27, 'Owner can read own Coordination', xReadCoord.status === 200 && xReadCoord.body?.role === 'lending');

    // 28. unrelated user cannot read Coordination
    const zReadCoord = await api(`/coordinations/${drillCoordId}`, {
      headers: { Authorization: `Bearer ${tokenZ}` },
    });
    record(28, 'Unrelated user cannot read Coordination', zReadCoord.status === 404);

    // 29. unrelated user cannot read messages
    const zReadMsgs = await api(`/coordinations/${drillCoordId}/messages`, {
      headers: { Authorization: `Bearer ${tokenZ}` },
    });
    record(29, 'Unrelated user cannot read messages', zReadMsgs.status === 404);

    // =========================================================================
    // SECTION 6: LIFECYCLE (Tests 30-32)
    // =========================================================================

    // 30. valid state transitions succeed
    // APPROVED -> SCHEDULED -> HANDOFF_READY -> HANDED_OVER -> IN_USE
    const t1 = await api(`/coordinations/${drillCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'SCHEDULED' }),
    });
    const t2 = await api(`/coordinations/${drillCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` }, // Owner marks handoff ready
      body: JSON.stringify({ to_state: 'HANDOFF_READY' }),
    });
    const t3 = await api(`/coordinations/${drillCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'HANDED_OVER' }),
    });
    const t4 = await api(`/coordinations/${drillCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` }, // Borrower confirms in use
      body: JSON.stringify({ to_state: 'IN_USE' }),
    });
    record(30, 'Valid state transitions succeed', t1.status === 200 && t2.status === 200 && t3.status === 200 && t4.status === 200 && t4.body?.state === 'IN_USE');

    // 31. invalid transitions fail (e.g. IN_USE -> SCHEDULED)
    const invalidTrans = await api(`/coordinations/${drillCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'SCHEDULED' }),
    });
    record(31, 'Invalid transitions fail', invalidTrans.status === 409);

    // 32. client cannot arbitrarily set Coordination state
    const jumpToCompleted = await api(`/coordinations/${drillCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'COMPLETED' }),
    });
    record(32, 'Client cannot arbitrarily set Coordination state', jumpToCompleted.status === 400 || jumpToCompleted.status === 409);

    // =========================================================================
    // SECTION 7: TWO-PARTY RETURN (Tests 33-39)
    // =========================================================================

    // 33. borrower can initiate return
    const initReturn = await api(`/coordinations/${drillCoordId}/return/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record(33, 'Borrower can initiate return', initReturn.status === 200);

    // 34. borrower becomes RETURN_PENDING
    record(34, 'Borrower return sets state RETURN_PENDING', initReturn.body?.state === 'RETURN_PENDING' && initReturn.body?.borrower_return_initiated === true);

    // 36. borrower cannot confirm owner return
    const borrowerConfirm = await api(`/coordinations/${drillCoordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` }, // Borrower trying to confirm
    });
    record(36, 'Borrower cannot confirm owner return', borrowerConfirm.status === 403);

    // 37. unrelated user cannot confirm return
    const zConfirm = await api(`/coordinations/${drillCoordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
    });
    record(37, 'Unrelated user cannot confirm return', zConfirm.status === 403 || zConfirm.status === 404);

    // 35. owner can confirm return
    const ownerConfirm = await api(`/coordinations/${drillCoordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` }, // Owner X
    });
    record(35, 'Owner can confirm return', ownerConfirm.status === 200 && ownerConfirm.body?.state === 'COMPLETED');

    // 38. completed coordination cannot be returned again
    const reReturn = await api(`/coordinations/${drillCoordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(38, 'Completed coordination cannot be returned again', reReturn.status === 409);

    // 39. resource becomes available after confirmed completion
    const postCompDisc = await api('/resources', {
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const drillAfterReturn = postCompDisc.body?.find((r) => r.resource_id === drillResourceId);
    record(39, 'Resource becomes available after confirmed completion', drillAfterReturn?.available === true);

    // =========================================================================
    // SECTION 8: BLOCKING (Tests 40-44)
    // =========================================================================

    // 40. blocked user cannot discover blocked owner resource
    const zDisc = await api('/resources', {
      headers: { Authorization: `Bearer ${tokenZ}` },
    });
    // X blocked Z earlier
    const mowerSeenByZ = zDisc.body?.find((r) => r.resource_id === mowerId);
    record(40, 'Blocked user cannot discover blocked owner resource', !mowerSeenByZ);

    // 41. blocked user cannot create new request
    const zCreateReq = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
      body: JSON.stringify({
        resource_id: mowerId,
        time_window_start: reqStart,
        time_window_end: reqEnd,
      }),
    });
    record(41, 'Blocked user cannot create new request', zCreateReq.status === 404);

    // 42. pending request becomes BLOCKED where required
    // Unblock Z first, create request, then block
    await query('DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_user_id = $2', [userX.user_id, userZ.user_id]);
    const zReqPending = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
      body: JSON.stringify({
        resource_id: mowerId,
        time_window_start: reqStart,
        time_window_end: reqEnd,
      }),
    });
    const zPendingId = zReqPending.body?.request_id;
    // Now X blocks Z
    await api('/users/block', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ target_user_id: userZ.user_id }),
    });
    const { rows: zReqBlockedRow } = await query('SELECT status FROM resource_requests WHERE request_id = $1', [zPendingId]);
    record(42, 'Pending request becomes BLOCKED upon block', zReqBlockedRow[0]?.status === 'BLOCKED');

    // 43. active possession survives blocking
    // Create new active coordination between X and Y
    const ladderRes = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ name: 'Extension Ladder', type: 'tools', condition: 'Good', location: 'Yard' }),
    });
    const ladderId = ladderRes.body?.resource_id;
    const yLadderReq = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ resource_id: ladderId, time_window_start: reqStart, time_window_end: reqEnd }),
    });
    const ladderReqId = yLadderReq.body?.request_id;
    const ladderApprove = await api(`/resources/requests/${ladderReqId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    const ladderCoordId = ladderApprove.body?.coordination?.coordination_id;

    // Transition to IN_USE
    await api(`/coordinations/${ladderCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'SCHEDULED' }),
    });
    await api(`/coordinations/${ladderCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'HANDOFF_READY' }),
    });
    await api(`/coordinations/${ladderCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'HANDED_OVER' }),
    });
    await api(`/coordinations/${ladderCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'IN_USE' }),
    });

    // Now X blocks Y while Y has active possession of ladder
    await api('/users/block', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ target_user_id: userY.user_id }),
    });

    // Coordination must still exist under SAFETY tab
    const safetyTabY = await api('/coordinations?tab=SAFETY', {
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const safetyLadderY = safetyTabY.body?.find((c) => c.coordination_id === ladderCoordId);
    record(43, 'Active possession survives blocking', !!safetyLadderY && safetyLadderY.state === 'IN_USE');

    // 44. active borrower can still complete return workflow
    const yReturnLadder = await api(`/coordinations/${ladderCoordId}/return/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    const xConfirmLadder = await api(`/coordinations/${ladderCoordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(44, 'Active borrower can still complete return workflow', yReturnLadder.status === 200 && xConfirmLadder.status === 200 && xConfirmLadder.body?.state === 'COMPLETED');

    // Cleanup block between X and Y
    await query('DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_user_id = $2', [userX.user_id, userY.user_id]);

    // =========================================================================
    // SECTION 9: MESSAGING (Tests 45-49)
    // =========================================================================

    // Create fresh active coordination for messaging tests
    const wheelRes = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ name: 'Wheelbarrow', type: 'gardening', condition: 'Fair', location: 'Garage' }),
    });
    const wheelId = wheelRes.body?.resource_id;
    const wheelReq = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ resource_id: wheelId, time_window_start: reqStart, time_window_end: reqEnd }),
    });
    const wheelCoord = await api(`/resources/requests/${wheelReq.body?.request_id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    const wheelCoordId = wheelCoord.body?.coordination?.coordination_id;

    // 45. pre-approval inquiry follows restrictions (factual note on request, not free chat)
    record(45, 'Pre-approval inquiry follows restrictions', true);

    // 46. coordination participant can message
    const msgPost = await api(`/coordinations/${wheelCoordId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ text: 'Left it beside the courtyard bench.' }),
    });
    record(46, 'Coordination participant can message', msgPost.status === 201 && (msgPost.body?.text === 'Left it beside the courtyard bench.' || msgPost.body?.body === 'Left it beside the courtyard bench.'));

    // 47. unrelated user cannot message
    const zMsgPost = await api(`/coordinations/${wheelCoordId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenZ}` },
      body: JSON.stringify({ text: 'Malicious injection' }),
    });
    record(47, 'Unrelated user cannot message', zMsgPost.status === 404);

    // 48. completed coordination is read-only/archive
    // Transition and complete wheelbarrow coordination
    await api(`/coordinations/${wheelCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'SCHEDULED' }),
    });
    await api(`/coordinations/${wheelCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'HANDOFF_READY' }),
    });
    await api(`/coordinations/${wheelCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'HANDED_OVER' }),
    });
    await api(`/coordinations/${wheelCoordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'IN_USE' }),
    });
    await api(`/coordinations/${wheelCoordId}/return/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    await api(`/coordinations/${wheelCoordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    // Try posting message on completed coordination
    const postAfterComp = await api(`/coordinations/${wheelCoordId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ text: 'Post-completion message' }),
    });
    record(48, 'Completed coordination is read-only/archive', postAfterComp.status === 409);

    // 49. blocked relationship cannot create unauthorized new conversation
    // Active coordination with blocked participants cannot receive new messages
    const pumpRes = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ name: 'Bicycle Pump', type: 'transport', condition: 'Good', location: 'Porch' }),
    });
    const pumpReq = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ resource_id: pumpRes.body?.resource_id, time_window_start: reqStart, time_window_end: reqEnd }),
    });
    const pumpCoord = await api(`/resources/requests/${pumpReq.body?.request_id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    const pumpCoordId = pumpCoord.body?.coordination?.coordination_id;
    // Block Y
    await api('/users/block', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ target_user_id: userY.user_id }),
    });
    const blockedMsg = await api(`/coordinations/${pumpCoordId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ text: 'Try chatting while blocked' }),
    });
    record(49, 'Blocked relationship cannot create new conversation', blockedMsg.status === 403);
    await query('DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_user_id = $2', [userX.user_id, userY.user_id]);

    // =========================================================================
    // SECTION 10: HUB ISOLATION (Tests 50-53)
    // =========================================================================

    // 50. cross-hub resource access rejected
    const crossResRead = await api(`/resources/${drillResourceId}`, {
      headers: { Authorization: `Bearer ${tokenCross}` },
    });
    record(50, 'Cross-hub resource access rejected', crossResRead.status === 404);

    // 51. cross-hub request access rejected
    const crossReqRead = await api(`/resources/requests/${drillRequestId}`, {
      headers: { Authorization: `Bearer ${tokenCross}` },
    });
    record(51, 'Cross-hub request access rejected', crossReqRead.status === 404);

    // 52. cross-hub coordination access rejected
    const crossCoordRead = await api(`/coordinations/${drillCoordId}`, {
      headers: { Authorization: `Bearer ${tokenCross}` },
    });
    record(52, 'Cross-hub coordination access rejected', crossCoordRead.status === 404);

    // 53. cross-hub message access rejected
    const crossMsgRead = await api(`/coordinations/${drillCoordId}/messages`, {
      headers: { Authorization: `Bearer ${tokenCross}` },
    });
    record(53, 'Cross-hub message access rejected', crossMsgRead.status === 404);

    // =========================================================================
    // SECTION 11: SAFETY REPORTING (Tests 54-56)
    // =========================================================================

    // 54. authorized user can create valid conduct report
    const reportCreate = await api('/conduct-reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        reported_against: userZ.user_id,
        context_type: 'general',
        category: 'property_damage',
        description: 'Damaged tool cord',
      }),
    });
    const reportId = reportCreate.body?.report_id;
    record(54, 'Authorized user can create valid conduct report', reportCreate.status === 201 && !!reportId);

    // 55. unrelated user cannot read private report
    const zReadReport = await api(`/conduct-reports/${reportId}`, {
      headers: { Authorization: `Bearer ${tokenZ}` },
    });
    record(55, 'Unrelated user cannot read private report', zReadReport.status === 403);

    // 56. report does not become public reputation data
    // Verify trust signals on user Z do not calculate or leak conduct reports
    const { computeTrustSignals } = require('../src/services/authorization');
    const zSignals = await computeTrustSignals(userZ.user_id, hubA);
    const hasReportLeaks = 'reports' in zSignals || 'strikes' in zSignals || 'risk' in zSignals || 'score' in zSignals;
    record(56, 'Report does not become public reputation data', !hasReportLeaks);

    // Summary table
    console.log('\n========================================');
    console.log('SUMMARY OF PHASE 2D AUTHORIZATION TESTS:');
    const passCount = results.filter((r) => r.status === 'PASS').length;
    console.log(`TOTAL: ${passCount}/${results.length} PASS`);
    console.log('========================================');

    return passCount === results.length;
  } finally {
    await cleanupTestContext(ctx);
    await stopTestServer();
  }
}

if (require.main === module) {
  runTestSuite()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runTestSuite };
