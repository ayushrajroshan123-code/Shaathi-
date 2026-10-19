/**
 * SAATHI Phase 2G-5B.3 Issues Integration Test Suite
 * Tests server-authoritative backend API for Neighborhood Issues:
 *  - Authentication & actor authority
 *  - Hub isolation & non-disclosing 404
 *  - Privacy projections (reported_by exclusion/inclusion)
 *  - Creation & validation (position_3d forced to {})
 *  - List filtering & default exclusion of resolved issues
 *  - Edit eligibility (original reporter only while reported)
 *  - Complete status transition matrix & authority enforcement
 *  - Concurrency handling
 */

const assert = require('assert');
const { startTestServer, stopTestServer, setupTestContext, cleanupTestContext } = require('./test_helper');
const { query } = require('../src/db');

async function request(baseUrl, path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const body = options.body ? JSON.stringify(options.body) : undefined;
  const res = await fetch(url, { method: options.method || 'GET', headers, body });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = text;
  }
  return { status: res.status, headers: res.headers, body: json };
}

async function runTests() {
  console.log('--- STARTING PHASE 2G-5B.3 ISSUES INTEGRATION TEST SUITE ---');
  let testServer = null;
  let ctx = null;

  try {
    testServer = await startTestServer();
    ctx = await setupTestContext();
    const baseUrl = testServer.baseUrl;

    const { userX, userY, userZ, userCoord, userCross } = ctx.users;
    const { tokenX, tokenY, tokenZ, tokenCoord, tokenCross } = ctx.tokens;

    // -------------------------------------------------------------------------
    // A. AUTHENTICATION AND AUTHORIZATION
    // -------------------------------------------------------------------------
    console.log('[Test A1] Unauthenticated request to /issues is rejected (401)');
    const resA1 = await request(baseUrl, '/issues');
    assert.strictEqual(resA1.status, 401);
    assert.strictEqual(resA1.body.error, 'UNAUTHENTICATED');

    console.log('[Test A2] Forged reported_by or hub_id in POST /issues is ignored');
    const resA2 = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: {
        title: 'Broken Bench',
        category: 'infrastructure',
        severity: 'low',
        general_location: 'Central Park',
        reported_by: userY.user_id, // Forged reporter
        hub_id: ctx.hubs.hubB,      // Forged hub
      },
    });
    assert.strictEqual(resA2.status, 201);
    assert.strictEqual(resA2.body.hub_id, ctx.hubs.hubA, 'Hub ID must be derived from token');
    assert.strictEqual(resA2.body.reported_by, userX.user_id, 'reported_by must be derived from token');
    const createdIssueId = resA2.body.issue_id;

    // -------------------------------------------------------------------------
    // B. HUB ISOLATION & NON-DISCLOSING 404
    // -------------------------------------------------------------------------
    console.log('[Test B1] Cross-hub resident receives 404 for GET /issues/:id');
    const resB1 = await request(baseUrl, `/issues/${createdIssueId}`, { token: tokenCross });
    assert.strictEqual(resB1.status, 404);
    assert.strictEqual(resB1.body.error, 'NOT_FOUND');

    console.log('[Test B2] Cross-hub resident receives 404 for PATCH /issues/:id');
    const resB2 = await request(baseUrl, `/issues/${createdIssueId}`, {
      method: 'PATCH',
      token: tokenCross,
      body: { title: 'Cross Hub Edit' },
    });
    assert.strictEqual(resB2.status, 404);

    console.log('[Test B3] Cross-hub resident receives 404 for PATCH /issues/:id/status');
    const resB3 = await request(baseUrl, `/issues/${createdIssueId}/status`, {
      method: 'PATCH',
      token: tokenCross,
      body: { status: 'attention_needed' },
    });
    assert.strictEqual(resB3.status, 404);

    // -------------------------------------------------------------------------
    // C. IDENTITY AND PRIVACY PROJECTIONS
    // -------------------------------------------------------------------------
    console.log('[Test C1] GET /issues list items NEVER include reported_by');
    const resC1 = await request(baseUrl, '/issues', { token: tokenX });
    assert.strictEqual(resC1.status, 200);
    assert.ok(Array.isArray(resC1.body));
    const listIssue = resC1.body.find((i) => i.issue_id === createdIssueId);
    assert.ok(listIssue);
    assert.strictEqual(listIssue.reported_by, undefined, 'reported_by must be omitted in list item');

    console.log('[Test C2] GET /issues/:id includes reported_by ONLY for original reporter');
    const resC2a = await request(baseUrl, `/issues/${createdIssueId}`, { token: tokenX }); // Original reporter
    assert.strictEqual(resC2a.status, 200);
    assert.strictEqual(resC2a.body.reported_by, userX.user_id);

    const resC2b = await request(baseUrl, `/issues/${createdIssueId}`, { token: tokenY }); // Other resident in same hub
    assert.strictEqual(resC2b.status, 200);
    assert.strictEqual(resC2b.body.reported_by, undefined, 'reported_by must be omitted for other resident');

    const resC2c = await request(baseUrl, `/issues/${createdIssueId}`, { token: tokenCoord }); // Coordinator in same hub
    assert.strictEqual(resC2c.status, 200);
    assert.strictEqual(resC2c.body.reported_by, undefined, 'reported_by must be omitted for coordinator if not original reporter');

    // -------------------------------------------------------------------------
    // D. CREATION AND INPUT VALIDATION
    // -------------------------------------------------------------------------
    console.log('[Test D1] Client-supplied position_3d is ignored; {} is persisted');
    const resD1 = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: {
        title: 'Street Lamp Malfunction',
        category: 'safety',
        severity: 'high',
        general_location: 'North Gate',
        position_3d: { x: 10, y: 20, z: 5 }, // Client attempting position injection
      },
    });
    assert.strictEqual(resD1.status, 201);
    assert.deepStrictEqual(resD1.body.position_3d, {}, 'position_3d must be empty object {}');

    console.log('[Test D2] Invalid category and severity are rejected (400)');
    const resD2a = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: { title: 'Test', category: 'invalid_cat', severity: 'high', general_location: 'Loc' },
    });
    assert.strictEqual(resD2a.status, 400);

    const resD2b = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: { title: 'Test', category: 'safety', severity: 'ultra_critical', general_location: 'Loc' },
    });
    assert.strictEqual(resD2b.status, 400);

    console.log('[Test D3] Missing required fields rejected (400)');
    const resD3 = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: { category: 'safety', severity: 'medium' },
    });
    assert.strictEqual(resD3.status, 400);

    // -------------------------------------------------------------------------
    // E. RETRIEVAL AND LIST FILTERING
    // -------------------------------------------------------------------------
    console.log('[Test E1] Default GET /issues excludes resolved issues');
    // Create a resolved issue directly to test filtering
    const resD_resolved = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: { title: 'Resolved Lamp', category: 'cleanliness', severity: 'low', general_location: 'Courtyard' },
    });
    const resolvedIssueId = resD_resolved.body.issue_id;
    await request(baseUrl, `/issues/${resolvedIssueId}/status`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'resolved' },
    });

    const resE1 = await request(baseUrl, '/issues', { token: tokenX });
    assert.strictEqual(resE1.status, 200);
    assert.strictEqual(resE1.body.some((i) => i.issue_id === resolvedIssueId), false, 'Default list must exclude resolved issues');

    console.log('[Test E2] GET /issues?status=resolved returns only resolved issues');
    const resE2 = await request(baseUrl, '/issues?status=resolved', { token: tokenX });
    assert.strictEqual(resE2.status, 200);
    assert.ok(resE2.body.every((i) => i.status === 'resolved'));
    assert.ok(resE2.body.some((i) => i.issue_id === resolvedIssueId));

    console.log('[Test E3] GET /issues?status=all returns all issues');
    const resE3 = await request(baseUrl, '/issues?status=all', { token: tokenX });
    assert.strictEqual(resE3.status, 200);
    assert.ok(resE3.body.some((i) => i.issue_id === createdIssueId));
    assert.ok(resE3.body.some((i) => i.issue_id === resolvedIssueId));

    console.log('[Test E4] Unsupported status filter returns 400');
    const resE4 = await request(baseUrl, '/issues?status=bogus_filter', { token: tokenX });
    assert.strictEqual(resE4.status, 400);

    // -------------------------------------------------------------------------
    // F. EDITING (PATCH /issues/:id)
    // -------------------------------------------------------------------------
    console.log('[Test F1] Original reporter can edit an issue in reported status');
    const resF1 = await request(baseUrl, `/issues/${createdIssueId}`, {
      method: 'PATCH',
      token: tokenX,
      body: { title: 'Broken Bench Updated', detail: 'Slat #3 is loose' },
    });
    assert.strictEqual(resF1.status, 200);
    assert.strictEqual(resF1.body.title, 'Broken Bench Updated');
    assert.strictEqual(resF1.body.detail, 'Slat #3 is loose');

    console.log('[Test F2] Non-reporter resident cannot edit issue (403)');
    const resF2 = await request(baseUrl, `/issues/${createdIssueId}`, {
      method: 'PATCH',
      token: tokenY,
      body: { title: 'Hacked Title' },
    });
    assert.strictEqual(resF2.status, 403);

    console.log('[Test F3] Coordinator cannot edit issue if not original reporter (403)');
    const resF3 = await request(baseUrl, `/issues/${createdIssueId}`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { title: 'Coordinator Title' },
    });
    assert.strictEqual(resF3.status, 403);

    console.log('[Test F4] Rejection of immutable field edit attempt (400)');
    const resF4 = await request(baseUrl, `/issues/${createdIssueId}`, {
      method: 'PATCH',
      token: tokenX,
      body: { title: 'Valid Title', status: 'in_progress' },
    });
    assert.strictEqual(resF4.status, 400);

    // -------------------------------------------------------------------------
    // G. COMPLETE STATUS TRANSITION MATRIX & AUTHORITY
    // -------------------------------------------------------------------------
    // Create fresh issue I1 by userX (status: reported)
    const resI1 = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: { title: 'Drain Blockage', category: 'infrastructure', severity: 'medium', general_location: 'Block A' },
    });
    const issueI1 = resI1.body.issue_id;

    console.log('[Test G1] reported -> attention_needed (resident Y allowed)');
    const resG1 = await request(baseUrl, `/issues/${issueI1}/status`, {
      method: 'PATCH',
      token: tokenY,
      body: { status: 'attention_needed' },
    });
    assert.strictEqual(resG1.status, 200);
    assert.strictEqual(resG1.body.status, 'attention_needed');

    console.log('[Test G2] Cannot edit issue after it left reported status (409)');
    const resG2 = await request(baseUrl, `/issues/${issueI1}`, {
      method: 'PATCH',
      token: tokenX,
      body: { title: 'Post-reported edit' },
    });
    assert.strictEqual(resG2.status, 409);
    assert.strictEqual(resG2.body.error, 'INVALID_STATE_TRANSITION');

    console.log('[Test G3] attention_needed -> in_progress (resident Z allowed)');
    const resG3 = await request(baseUrl, `/issues/${issueI1}/status`, {
      method: 'PATCH',
      token: tokenZ,
      body: { status: 'in_progress' },
    });
    assert.strictEqual(resG3.status, 200);
    assert.strictEqual(resG3.body.status, 'in_progress');

    console.log('[Test G4] in_progress -> parts_ordered (resident Y denied: 403)');
    const resG4a = await request(baseUrl, `/issues/${issueI1}/status`, {
      method: 'PATCH',
      token: tokenY,
      body: { status: 'parts_ordered' },
    });
    assert.strictEqual(resG4a.status, 403);

    console.log('[Test G5] in_progress -> parts_ordered (coordinator allowed: 200)');
    const resG5 = await request(baseUrl, `/issues/${issueI1}/status`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { status: 'parts_ordered' },
    });
    assert.strictEqual(resG5.status, 200);
    assert.strictEqual(resG5.body.status, 'parts_ordered');

    console.log('[Test G6] parts_ordered -> in_progress (coordinator allowed: 200)');
    const resG6 = await request(baseUrl, `/issues/${issueI1}/status`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { status: 'in_progress' },
    });
    assert.strictEqual(resG6.status, 200);
    assert.strictEqual(resG6.body.status, 'in_progress');

    console.log('[Test G7] in_progress -> resolved (original reporter X allowed: 200)');
    const resG7 = await request(baseUrl, `/issues/${issueI1}/status`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'resolved' },
    });
    assert.strictEqual(resG7.status, 200);
    assert.strictEqual(resG7.body.status, 'resolved');

    console.log('[Test G8] resolved -> attention_needed without reason rejected (400)');
    const resG8 = await request(baseUrl, `/issues/${issueI1}/status`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'attention_needed' },
    });
    assert.strictEqual(resG8.status, 400);

    console.log('[Test G9] resolved -> attention_needed with reason (reporter X allowed: 200)');
    const resG9 = await request(baseUrl, `/issues/${issueI1}/status`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'attention_needed', reason: 'Drain blocked again after rain' },
    });
    assert.strictEqual(resG9.status, 200);
    assert.strictEqual(resG9.body.status, 'attention_needed');

    console.log('[Test G10] attention_needed -> resolved (coordinator allowed: 200)');
    const resG10 = await request(baseUrl, `/issues/${issueI1}/status`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { status: 'resolved' },
    });
    assert.strictEqual(resG10.status, 200);
    assert.strictEqual(resG10.body.status, 'resolved');

    console.log('[Test G11] Disallowed transition resolved -> in_progress rejected (409)');
    const resG11 = await request(baseUrl, `/issues/${issueI1}/status`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { status: 'in_progress' },
    });
    assert.strictEqual(resG11.status, 409);
    assert.strictEqual(resG11.body.error, 'INVALID_STATE_TRANSITION');

    console.log('[Test G12] Unsupported status string "withdrawn" rejected (400)');
    const resG12 = await request(baseUrl, `/issues/${issueI1}/status`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'withdrawn' },
    });
    assert.strictEqual(resG12.status, 400);

    console.log('[Test G13] Same-status request is idempotent (200, no error)');
    const resG13 = await request(baseUrl, `/issues/${issueI1}/status`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'resolved' },
    });
    assert.strictEqual(resG13.status, 200);
    assert.strictEqual(resG13.body.status, 'resolved');

    // -------------------------------------------------------------------------
    // H. CONCURRENCY HANDLING
    // -------------------------------------------------------------------------
    console.log('[Test H1] Concurrent status updates handle conflict safely');
    const resI2 = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: { title: 'Concurrency Fence', category: 'gardening', severity: 'low', general_location: 'Garden' },
    });
    const issueI2 = resI2.body.issue_id;

    // Run two competing status transition requests concurrently
    const [p1, p2] = await Promise.all([
      request(baseUrl, `/issues/${issueI2}/status`, { method: 'PATCH', token: tokenX, body: { status: 'attention_needed' } }),
      request(baseUrl, `/issues/${issueI2}/status`, { method: 'PATCH', token: tokenY, body: { status: 'in_progress' } }),
    ]);

    // One must succeed (200), and both responses must be valid HTTP statuses without crashes
    const statuses = [p1.status, p2.status].sort();
    assert.ok(statuses.includes(200), 'At least one request must succeed');

    // -------------------------------------------------------------------------
    // I. SAME-STATUS AUTHORIZATION TESTS (DEFECT-01 REGRESSION SUITE)
    // -------------------------------------------------------------------------
    // Setup an issue in parts_ordered status: reported -> in_progress -> parts_ordered
    const resPo = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: { title: 'Parts Ordering Test Issue', category: 'infrastructure', severity: 'high', general_location: 'Power Station' },
    });
    const poIssueId = resPo.body.issue_id;
    await request(baseUrl, `/issues/${poIssueId}/status`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'in_progress' },
    });
    await request(baseUrl, `/issues/${poIssueId}/status`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { status: 'parts_ordered' },
    });

    console.log('[Test I1] Ordinary resident cannot idempotently target parts_ordered (403)');
    const resI1a = await request(baseUrl, `/issues/${poIssueId}/status`, {
      method: 'PATCH',
      token: tokenY,
      body: { status: 'parts_ordered' },
    });
    assert.strictEqual(resI1a.status, 403, 'Ordinary resident must receive 403 when targeting parts_ordered');
    const { rows: dbRowsI1 } = await query('SELECT status FROM neighborhood_issues WHERE issue_id = $1', [poIssueId]);
    assert.strictEqual(dbRowsI1[0].status, 'parts_ordered', 'DB status must remain parts_ordered');

    console.log('[Test I2] Coordinator can idempotently target parts_ordered (200, zero mutation)');
    const { rows: dbBeforeI2 } = await query('SELECT * FROM neighborhood_issues WHERE issue_id = $1', [poIssueId]);
    const resI2a = await request(baseUrl, `/issues/${poIssueId}/status`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { status: 'parts_ordered' },
    });
    assert.strictEqual(resI2a.status, 200);
    assert.strictEqual(resI2a.body.status, 'parts_ordered');
    const { rows: dbAfterI2 } = await query('SELECT * FROM neighborhood_issues WHERE issue_id = $1', [poIssueId]);
    assert.deepStrictEqual(dbBeforeI2[0], dbAfterI2[0], 'Database row must remain completely unchanged');

    // Setup an issue in resolved status
    const resRes = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: { title: 'Resolved Test Issue', category: 'cleanliness', severity: 'low', general_location: 'South Alley' },
    });
    const resIssueId = resRes.body.issue_id;
    await request(baseUrl, `/issues/${resIssueId}/status`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'resolved' },
    });

    console.log('[Test I3] Unrelated resident cannot idempotently target resolved (403)');
    const resI3a = await request(baseUrl, `/issues/${resIssueId}/status`, {
      method: 'PATCH',
      token: tokenY,
      body: { status: 'resolved' },
    });
    assert.strictEqual(resI3a.status, 403, 'Unrelated resident must receive 403 when targeting resolved');
    assert.strictEqual(resI3a.body.reported_by, undefined, 'Must not expose reported_by on 403');
    const { rows: dbRowsI3 } = await query('SELECT status FROM neighborhood_issues WHERE issue_id = $1', [resIssueId]);
    assert.strictEqual(dbRowsI3[0].status, 'resolved', 'DB status must remain resolved');

    console.log('[Test I4] Original reporter can idempotently target resolved (200, zero mutation)');
    const { rows: dbBeforeI4 } = await query('SELECT * FROM neighborhood_issues WHERE issue_id = $1', [resIssueId]);
    const resI4a = await request(baseUrl, `/issues/${resIssueId}/status`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'resolved' },
    });
    assert.strictEqual(resI4a.status, 200);
    assert.strictEqual(resI4a.body.status, 'resolved');
    assert.strictEqual(resI4a.body.reported_by, userX.user_id, 'Original reporter receives creator projection');
    const { rows: dbAfterI4 } = await query('SELECT * FROM neighborhood_issues WHERE issue_id = $1', [resIssueId]);
    assert.deepStrictEqual(dbBeforeI4[0], dbAfterI4[0], 'Database row must remain completely unchanged');

    console.log('[Test I5] Same-hub coordinator can idempotently target resolved (200, zero mutation)');
    const { rows: dbBeforeI5 } = await query('SELECT * FROM neighborhood_issues WHERE issue_id = $1', [resIssueId]);
    const resI5a = await request(baseUrl, `/issues/${resIssueId}/status`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { status: 'resolved' },
    });
    assert.strictEqual(resI5a.status, 200);
    assert.strictEqual(resI5a.body.status, 'resolved');
    assert.strictEqual(resI5a.body.reported_by, undefined, 'Coordinator receives public projection (omits reported_by)');
    const { rows: dbAfterI5 } = await query('SELECT * FROM neighborhood_issues WHERE issue_id = $1', [resIssueId]);
    assert.deepStrictEqual(dbBeforeI5[0], dbAfterI5[0], 'Database row must remain completely unchanged');

    console.log('[Test I6] Coordinator from another hub cannot target same status (404)');
    const resI6a = await request(baseUrl, `/issues/${poIssueId}/status`, {
      method: 'PATCH',
      token: tokenCross,
      body: { status: 'parts_ordered' },
    });
    assert.strictEqual(resI6a.status, 404, 'Cross-hub request must receive non-disclosing 404');

    console.log('[Test I7] Unauthenticated same-status request rejected (401)');
    const resI7a = await request(baseUrl, `/issues/${poIssueId}/status`, {
      method: 'PATCH',
      body: { status: 'parts_ordered' },
    });
    assert.strictEqual(resI7a.status, 401);

    console.log('[Test I8] Target status "reported" is rejected with 403 and zero DB mutation');
    const resRep = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: { title: 'Reported Status Test Issue', category: 'safety', severity: 'medium', general_location: 'Gate 2' },
    });
    const repIssueId = resRep.body.issue_id;
    const { rows: dbBeforeI8 } = await query('SELECT * FROM neighborhood_issues WHERE issue_id = $1', [repIssueId]);
    const resI8 = await request(baseUrl, `/issues/${repIssueId}/status`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'reported' },
    });
    assert.strictEqual(resI8.status, 403, 'Target status reported must be rejected with 403');
    assert.strictEqual(resI8.body.error, 'FORBIDDEN');
    const { rows: dbAfterI8 } = await query('SELECT * FROM neighborhood_issues WHERE issue_id = $1', [repIssueId]);
    assert.deepStrictEqual(dbBeforeI8[0], dbAfterI8[0], 'Database row must remain completely unchanged');

    console.log('[Test I9] Same-hub resident can idempotently target in_progress (200, zero mutation)');
    const resIp = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: { title: 'In Progress Test Issue', category: 'infrastructure', severity: 'low', general_location: 'Park Lane' },
    });
    const ipIssueId = resIp.body.issue_id;
    await request(baseUrl, `/issues/${ipIssueId}/status`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'in_progress' },
    });
    const { rows: dbBeforeI9 } = await query('SELECT * FROM neighborhood_issues WHERE issue_id = $1', [ipIssueId]);
    const resI9 = await request(baseUrl, `/issues/${ipIssueId}/status`, {
      method: 'PATCH',
      token: tokenY,
      body: { status: 'in_progress' },
    });
    assert.strictEqual(resI9.status, 200);
    assert.strictEqual(resI9.body.status, 'in_progress');
    const { rows: dbAfterI9 } = await query('SELECT * FROM neighborhood_issues WHERE issue_id = $1', [ipIssueId]);
    assert.deepStrictEqual(dbBeforeI9[0], dbAfterI9[0], 'Database row must remain completely unchanged');

    console.log('[Test I10] Same-hub resident can idempotently target attention_needed (200, zero mutation)');
    const resAn = await request(baseUrl, '/issues', {
      method: 'POST',
      token: tokenX,
      body: { title: 'Attention Needed Test Issue', category: 'gardening', severity: 'medium', general_location: 'West Lawn' },
    });
    const anIssueId = resAn.body.issue_id;
    await request(baseUrl, `/issues/${anIssueId}/status`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'attention_needed' },
    });
    const { rows: dbBeforeI10 } = await query('SELECT * FROM neighborhood_issues WHERE issue_id = $1', [anIssueId]);
    const resI10 = await request(baseUrl, `/issues/${anIssueId}/status`, {
      method: 'PATCH',
      token: tokenZ,
      body: { status: 'attention_needed' },
    });
    assert.strictEqual(resI10.status, 200);
    assert.strictEqual(resI10.body.status, 'attention_needed');
    const { rows: dbAfterI10 } = await query('SELECT * FROM neighborhood_issues WHERE issue_id = $1', [anIssueId]);
    assert.deepStrictEqual(dbBeforeI10[0], dbAfterI10[0], 'Database row must remain completely unchanged');

    console.log('--- ALL PHASE 2G-5B.3 ISSUES INTEGRATION TESTS PASSED ---');
  } finally {
    if (ctx) await cleanupTestContext(ctx);
    if (testServer) await stopTestServer();
  }
}

runTests().catch((err) => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
