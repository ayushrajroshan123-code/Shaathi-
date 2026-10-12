/**
 * SAATHI Phase 2G-3 Return State Fix Verification Suite
 *
 * Verifies that the server strictly enforces return lifecycle state transitions:
 *  - RETURN_DUE -> COMPLETED via POST /return/confirm is rejected with 409 INVALID_STATE
 *  - Coordination state remains RETURN_DUE, no completion event, resource availability unchanged
 *  - Legitimate RETURN_DUE -> RETURN_PENDING -> COMPLETED flow succeeds
 *  - Borrower cannot confirm return (403 FORBIDDEN)
 *  - Duplicate return confirmation rejected (409 INVALID_STATE)
 *  - Concurrency & row-locking guarantees preserved
 */

require('dotenv').config();
const assert = require('assert');
const { pool, query } = require('../src/db');
const {
  startTestServer,
  stopTestServer,
  setupTestContext,
  cleanupTestContext,
} = require('./test_helper');

async function runSuite() {
  console.log('========================================================');
  console.log('STARTING SAATHI PHASE 2G-3 RETURN STATE FIX SUITE');
  console.log('========================================================\n');

  const { baseUrl } = await startTestServer();
  const ctx = await setupTestContext();
  const results = [];

  function record(id, title, pass, details = '') {
    results.push({ id, title, status: pass ? 'PASS' : 'FAIL', details });
    console.log(`[Test ${id.toString().padStart(2, '0')}] ${title}: ${pass ? 'PASS' : 'FAIL'}${details ? ' - ' + details : ''}`);
  }

  try {
    const { tokenX, tokenY } = ctx.tokens;

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

    // --- SETUP: Create a test resource owned by X ---
    const resCreate = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        name: 'Phase 2G-3 Test Pressure Washer',
        type: 'tools',
        condition: 'Good',
        general_area: 'Greenwood Commons',
      }),
    });
    assert.strictEqual(resCreate.status, 201, `Create resource failed: ${JSON.stringify(resCreate.body)}`);
    const resourceId = resCreate.body.resource_id;

    // Y requests resource
    const now = new Date();
    const tomorrow = new Date(Date.now() + 86400000);
    const reqCreate = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: resourceId,
        time_window_start: now.toISOString(),
        time_window_end: tomorrow.toISOString(),
      }),
    });
    assert.strictEqual(reqCreate.status, 201, `Create request failed: ${JSON.stringify(reqCreate.body)}`);
    const requestId = reqCreate.body.request_id;

    // X approves request -> Coordination spawned
    const reqApprove = await api(`/resources/requests/${requestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    assert.strictEqual(reqApprove.status, 200, `Approve request failed: ${JSON.stringify(reqApprove.body)}`);
    const coordId = reqApprove.body.coordination.coordination_id;

    const t1 = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'SCHEDULED' }),
    });
    if (t1.status !== 200) console.log('SCHEDULED error:', t1.body);

    const t2 = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'HANDOFF_READY' }),
    });
    if (t2.status !== 200) console.log('HANDOFF_READY error:', t2.body);

    const t3 = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'HANDED_OVER' }),
    });
    if (t3.status !== 200) console.log('HANDED_OVER error:', t3.body);

    const t4 = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'IN_USE' }),
    });
    if (t4.status !== 200) console.log('IN_USE error:', t4.body);

    const t5 = await api(`/coordinations/${coordId}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'RETURN_DUE' }),
    });
    if (t5.status !== 200) console.log('RETURN_DUE error:', t5.body);

    // Verify initial RETURN_DUE state
    const detailDue = await api(`/coordinations/${coordId}`, {
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(1, 'Coordination advanced to RETURN_DUE state', detailDue.body?.state === 'RETURN_DUE');

    // Verify resource is unavailable
    const resCheckDue = await api(`/resources/${resourceId}`, {
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(2, 'Resource availability is false while in RETURN_DUE', resCheckDue.body?.available === false);

    // =========================================================================
    // TEST 1: Malicious owner confirmation at RETURN_DUE
    // =========================================================================
    const confirmAtDueRes = await api(`/coordinations/${coordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });

    record(
      3,
      'Owner confirmation at RETURN_DUE returns 409 INVALID_STATE',
      confirmAtDueRes.status === 409 && confirmAtDueRes.body?.error === 'INVALID_STATE'
    );

    // Verify state remains RETURN_DUE
    const detailAfterAttempt = await api(`/coordinations/${coordId}`, {
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(4, 'State remains RETURN_DUE after rejected confirmation', detailAfterAttempt.body?.state === 'RETURN_DUE');

    // Verify no COMPLETED or RETURN_CONFIRMED event created
    const events = detailAfterAttempt.body?.events || [];
    const hasCompletedEvent = events.some((e) => e.event_type === 'COMPLETED' || e.event_type === 'RETURN_CONFIRMED');
    record(5, 'No COMPLETED or RETURN_CONFIRMED event inserted', !hasCompletedEvent);

    // Verify resource availability unchanged
    const resCheckAfterAttempt = await api(`/resources/${resourceId}`, {
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(6, 'Resource availability remains false', resCheckAfterAttempt.body?.available === false);

    // =========================================================================
    // TEST 3: Borrower cannot confirm return
    // =========================================================================
    const borrowerConfirmAtDue = await api(`/coordinations/${coordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record(7, 'Borrower confirmReturn is rejected with 403 FORBIDDEN', borrowerConfirmAtDue.status === 403);

    // =========================================================================
    // TEST 2: Legitimate return flow (RETURN_DUE -> RETURN_PENDING -> COMPLETED)
    // =========================================================================
    // Borrower initiates return
    const initRes = await api(`/coordinations/${coordId}/return/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record(8, 'Borrower initiateReturn transition state to RETURN_PENDING', initRes.status === 200 && initRes.body?.state === 'RETURN_PENDING');

    // Borrower STILL cannot confirm return at RETURN_PENDING
    const borrowerConfirmAtPending = await api(`/coordinations/${coordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record(9, 'Borrower confirmReturn at RETURN_PENDING rejected with 403 FORBIDDEN', borrowerConfirmAtPending.status === 403);

    // Owner confirms return
    const ownerConfirmRes = await api(`/coordinations/${coordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(10, 'Owner confirmReturn at RETURN_PENDING transition to COMPLETED', ownerConfirmRes.status === 200 && ownerConfirmRes.body?.state === 'COMPLETED');

    // Verify resource availability restored
    const resCheckCompleted = await api(`/resources/${resourceId}`, {
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(11, 'Resource availability restored to true after COMPLETED', resCheckCompleted.body?.available === true);

    // =========================================================================
    // TEST 4: Duplicate confirmation
    // =========================================================================
    const duplicateConfirmRes = await api(`/coordinations/${coordId}/return/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record(12, 'Duplicate owner confirmReturn rejected with 409 INVALID_STATE', duplicateConfirmRes.status === 409 && duplicateConfirmRes.body?.error === 'INVALID_STATE');

    // =========================================================================
    // TEST 5: Concurrency check
    // =========================================================================
    // Setup another coordination and advance to RETURN_PENDING
    const resCreate2 = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        name: 'Phase 2G-3 Concurrent Tool',
        type: 'tools',
        condition: 'Good',
        general_area: 'Greenwood Commons',
      }),
    });
    const resourceId2 = resCreate2.body.resource_id;

    const reqCreate2 = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: resourceId2,
        time_window_start: now.toISOString(),
        time_window_end: tomorrow.toISOString(),
      }),
    });
    const reqApprove2 = await api(`/resources/requests/${reqCreate2.body.request_id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    const coordId2 = reqApprove2.body.coordination.coordination_id;

    await api(`/coordinations/${coordId2}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'SCHEDULED' }),
    });
    await api(`/coordinations/${coordId2}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'HANDOFF_READY' }),
    });
    await api(`/coordinations/${coordId2}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({ to_state: 'HANDED_OVER' }),
    });
    await api(`/coordinations/${coordId2}/transition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({ to_state: 'IN_USE' }),
    });
    await api(`/coordinations/${coordId2}/return/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });

    // Fire two parallel return confirmations
    const [c1, c2] = await Promise.all([
      api(`/coordinations/${coordId2}/return/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } }),
      api(`/coordinations/${coordId2}/return/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } }),
    ]);

    const statuses = [c1.status, c2.status].sort();
    record(13, 'Concurrent confirmation handles race condition safely (one 200, one 409)', statuses[0] === 200 && statuses[1] === 409);

  } finally {
    await cleanupTestContext(ctx);
    await stopTestServer();
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  console.log('\n========================================');
  console.log(`SUMMARY OF PHASE 2G-3 RETURN STATE FIX TESTS:`);
  console.log(`TOTAL: ${results.length - failed.length}/${results.length} PASS`);
  console.log('========================================\n');

  if (failed.length > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSuite().catch((err) => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  });
}
