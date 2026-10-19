/**
 * SAATHI Phase 2H Unit 4 Emergency Routes HTTP Integration Test Suite
 *
 * Validates locked HTTP route-to-service contracts:
 *  - Feature flag gating (ENABLE_EMERGENCY_ROUTES=false returns 404)
 *  - Authentication enforcement (401 for unauthenticated/invalid tokens)
 *  - Role-based authorization enforcement (403 for non-coordinators on coordinator routes)
 *  - Strict hub isolation and anti-probing 404 for cross-hub entity lookups
 *  - GPS location privacy projections (redacted for ordinary residents & unassigned helpers,
 *    retained for coordinators/initiators/active helpers, redacted upon incident resolution)
 *  - End-to-end delegation from routes to emergencyService methods
 *  - Clean error formatting through central error handler
 *  - Database safety guard (saathi_test only)
 */

require('dotenv').config();
const assert = require('assert');
const http = require('http');
const { query } = require('../src/db');
const {
  setupTestContext,
  cleanupTestContext,
} = require('./test_helper');

async function assertTestDatabase() {
  const { rows } = await query('SELECT current_database() AS database_name');
  const dbName = rows && rows[0] ? rows[0].database_name : null;
  if (dbName !== 'saathi_test') {
    throw new Error(`FATAL: Database guard triggered! Expected 'saathi_test', connected to '${dbName}'. Test aborted.`);
  }
}

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

function createServerOnPort(expressApp) {
  return new Promise((resolve) => {
    const srv = http.createServer(expressApp);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      resolve({ server: srv, port, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function closeServer(srv) {
  return new Promise((resolve) => srv.close(resolve));
}

async function runTestSuite() {
  console.log('--- STARTING PHASE 2H UNIT 4 EMERGENCY ROUTES HTTP TEST SUITE ---');
  await assertTestDatabase();
  console.log('[Database Guard] Verified connected to dedicated test database: saathi_test');

  const results = [];
  function record(id, title, pass, details = '') {
    results.push({ id, title, status: pass ? 'PASS' : 'FAIL', details });
    console.log(`[Test ${id.toString().padStart(2, '0')}] ${title}: ${pass ? 'PASS' : 'FAIL'}${details ? ' - ' + details : ''}`);
  }

  const trackedIncidentIds = [];
  let ctx = null;
  let flagDisabledServer = null;
  let activeServer = null;

  try {
    ctx = await setupTestContext();
    const { hubA, hubB } = ctx.hubs;
    const { userX, userY, userZ, userCoord, userCross } = ctx.users;
    const { tokenX, tokenY, tokenZ, tokenCoord, tokenCross } = ctx.tokens;

    // Setup inventory resources in Hub A and Hub B for testing deployment route
    const { rows: resARows } = await query(`
      INSERT INTO resource_inventory (owner_id, hub_id, type, condition, location, name)
      VALUES ($1, $2, 'emergency', 'good', 'Alpha Shelter', 'Kit A1')
      RETURNING resource_id
    `, [userX.user_id, hubA]);
    const resourceA_Id = resARows[0].resource_id;

    const { rows: resBRows } = await query(`
      INSERT INTO resource_inventory (owner_id, hub_id, type, condition, location, name)
      VALUES ($1, $2, 'emergency', 'good', 'Beta Shelter', 'Generator B1')
      RETURNING resource_id
    `, [userCross.user_id, hubB]);
    const resourceB_Id = resBRows[0].resource_id;

    // =========================================================================
    // SECTION 1: FEATURE FLAG ISOLATION (ENABLE_EMERGENCY_ROUTES = false)
    // =========================================================================
    const originalFlag = process.env.ENABLE_EMERGENCY_ROUTES;
    process.env.ENABLE_EMERGENCY_ROUTES = 'false';
    delete require.cache[require.resolve('../src/app')];
    const appDisabled = require('../src/app');
    flagDisabledServer = await createServerOnPort(appDisabled);

    const flagRes1 = await request(flagDisabledServer.baseUrl, '/incidents', {
      method: 'GET',
      token: tokenCoord,
    });
    record(1, 'Feature flag disabled: GET /incidents returns 404', flagRes1.status === 404, `status: ${flagRes1.status}`);

    const flagRes2 = await request(flagDisabledServer.baseUrl, '/emergency-alerts', {
      method: 'POST',
      token: tokenCoord,
      body: { level: 'warning', source: 'coordinator', affected_area: 'Zone A' },
    });
    record(2, 'Feature flag disabled: POST /emergency-alerts returns 404', flagRes2.status === 404, `status: ${flagRes2.status}`);

    await closeServer(flagDisabledServer.server);
    flagDisabledServer = null;

    // =========================================================================
    // SECTION 2: TEST SERVER WITH ROUTES MOUNTED (IN-PROCESS TEST CONTEXT)
    // =========================================================================
    process.env.ENABLE_EMERGENCY_ROUTES = 'true';
    delete require.cache[require.resolve('../src/app')];
    const appActive = require('../src/app');
    activeServer = await createServerOnPort(appActive);
    const baseUrl = activeServer.baseUrl;

    // T03: Unauthenticated request rejected (401)
    const unauthRes = await request(baseUrl, '/incidents', { method: 'GET' });
    record(3, 'Unauthenticated request rejected with 401', unauthRes.status === 401 && unauthRes.body.error === 'UNAUTHENTICATED');

    // T04: Invalid bearer token rejected (401)
    const badTokenRes = await request(baseUrl, '/incidents', {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid-token-12345' },
    });
    record(4, 'Invalid bearer token rejected with 401', badTokenRes.status === 401 && badTokenRes.body.error === 'UNAUTHENTICATED');

    // T05: Coordinator route rejects non-coordinator (403) - POST /emergency-alerts
    const residentAlertRes = await request(baseUrl, '/emergency-alerts', {
      method: 'POST',
      token: tokenX,
      body: { level: 'warning', source: 'coordinator', affected_area: 'Zone 1' },
    });
    record(5, 'Non-coordinator resident cannot POST /emergency-alerts (403)', residentAlertRes.status === 403 && residentAlertRes.body.error === 'FORBIDDEN');

    // T06: Coordinator route rejects non-coordinator (403) - PATCH /incidents/:id
    const fakeIncId = '00000000-0000-0000-0000-000000000001';
    const residentPatchRes = await request(baseUrl, `/incidents/${fakeIncId}`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'COORDINATING' },
    });
    record(6, 'Non-coordinator resident cannot PATCH /incidents/:id (403)', residentPatchRes.status === 403 && residentPatchRes.body.error === 'FORBIDDEN');

    // T07: Coordinator route rejects non-coordinator (403) - POST /incidents/:id/resources
    const residentResDeploy = await request(baseUrl, `/incidents/${fakeIncId}/resources`, {
      method: 'POST',
      token: tokenX,
      body: { resource_id: resourceA_Id },
    });
    record(7, 'Non-coordinator resident cannot POST /incidents/:id/resources (403)', residentResDeploy.status === 403 && residentResDeploy.body.error === 'FORBIDDEN');

    // T08: Coordinator route rejects non-coordinator (403) - POST /help-requests/:id/match
    const fakeReqId = '00000000-0000-0000-0000-000000000002';
    const residentMatchRes = await request(baseUrl, `/help-requests/${fakeReqId}/match`, {
      method: 'POST',
      token: tokenX,
      body: { matched_helper_id: userY.user_id },
    });
    record(8, 'Non-coordinator resident cannot POST /help-requests/:id/match (403)', residentMatchRes.status === 403 && residentMatchRes.body.error === 'FORBIDDEN');

    // =========================================================================
    // SECTION 3: INCIDENTS ENDPOINTS (POST, GET, LIST, PATCH)
    // =========================================================================

    // T09: Resident creates incident: 201 Created; location & coordinates redacted to null
    const createIncRes = await request(baseUrl, '/incidents', {
      method: 'POST',
      token: tokenX,
      body: {
        source: 'SOS',
        location: 'Building A, Apt 4B',
        latitude: 12.9716,
        longitude: 77.5946,
        affected_people: 2,
        vulnerable_people: 'elderly',
      },
    });
    const incResident = createIncRes.body;
    trackedIncidentIds.push(incResident.incident_id);
    const incCreatedOk = createIncRes.status === 201 &&
      incResident.incident_id &&
      incResident.hub_id === hubA &&
      incResident.location === null &&
      incResident.latitude === null &&
      incResident.longitude === null;
    record(9, 'Resident creates incident: 201 Created with coordinates redacted to null', incCreatedOk);

    // T10: Coordinator creates incident: 201 Created with coordinates visible
    const createIncCoordRes = await request(baseUrl, '/incidents', {
      method: 'POST',
      token: tokenCoord,
      body: {
        source: 'alert',
        location: 'Community Hall Roof',
        latitude: 12.9720,
        longitude: 77.5950,
        affected_people: 5,
        vulnerable_people: 'none',
      },
    });
    const incCoord = createIncCoordRes.body;
    trackedIncidentIds.push(incCoord.incident_id);
    const incCoordCreatedOk = createIncCoordRes.status === 201 &&
      incCoord.location === 'Community Hall Roof' &&
      incCoord.latitude === 12.9720 &&
      incCoord.longitude === 77.5950;
    record(10, 'Coordinator creates incident: 201 Created with exact coordinates visible', incCoordCreatedOk);

    // T11: Cross-hub resident requests incident: 404 NOT_FOUND (anti-probing)
    const crossHubIncRes = await request(baseUrl, `/incidents/${incResident.incident_id}`, {
      method: 'GET',
      token: tokenCross,
    });
    record(11, 'Cross-hub resident GET /incidents/:id returns 404 NOT_FOUND', crossHubIncRes.status === 404 && crossHubIncRes.body.error === 'NOT_FOUND');

    // T12: Same-hub unassigned resident requests incident: 200 OK with null coordinates
    const unassignedGetRes = await request(baseUrl, `/incidents/${incResident.incident_id}`, {
      method: 'GET',
      token: tokenZ,
    });
    const unassignedInc = unassignedGetRes.body;
    const unassignedOk = unassignedGetRes.status === 200 &&
      unassignedInc.incident_id === incResident.incident_id &&
      unassignedInc.location === null &&
      unassignedInc.latitude === null;
    record(12, 'Same-hub unassigned resident GET /incidents/:id receives null coordinates', unassignedOk);

    // T13: Coordinator requests incident: 200 OK with full coordinates
    const coordGetRes = await request(baseUrl, `/incidents/${incResident.incident_id}`, {
      method: 'GET',
      token: tokenCoord,
    });
    const coordInc = coordGetRes.body;
    const coordOk = coordGetRes.status === 200 &&
      coordInc.location === 'Building A, Apt 4B' &&
      coordInc.latitude === 12.9716;
    record(13, 'Authorized coordinator GET /incidents/:id receives full coordinates', coordOk);

    // =========================================================================
    // SECTION 4: HELPERS AND RESOURCES
    // =========================================================================

    // T14: Assign cross-hub helper: 400 VALIDATION_ERROR
    const crossHelperRes = await request(baseUrl, `/incidents/${incResident.incident_id}/helpers`, {
      method: 'POST',
      token: tokenCoord,
      body: { user_id: userCross.user_id },
    });
    record(14, 'Assigning cross-hub helper returns 400 VALIDATION_ERROR', crossHelperRes.status === 400 && crossHelperRes.body.error === 'VALIDATION_ERROR');

    // T15: Assign same-hub helper: 201 Created
    const helperAssignRes = await request(baseUrl, `/incidents/${incResident.incident_id}/helpers`, {
      method: 'POST',
      token: tokenCoord,
      body: { user_id: userY.user_id },
    });
    record(15, 'Assigning same-hub helper returns 201 Created', helperAssignRes.status === 201 && helperAssignRes.body.incident_id === incResident.incident_id);

    // T16: Assigned helper GET /incidents/:id receives exact coordinates
    const helperGetRes = await request(baseUrl, `/incidents/${incResident.incident_id}`, {
      method: 'GET',
      token: tokenY,
    });
    const helperInc = helperGetRes.body;
    const helperOk = helperGetRes.status === 200 &&
      helperInc.location === 'Building A, Apt 4B' &&
      helperInc.latitude === 12.9716;
    record(16, 'Assigned helper GET /incidents/:id receives exact coordinates', helperOk);

    // T17: Coordinator deploys cross-hub resource: 400 VALIDATION_ERROR
    const crossDeployRes = await request(baseUrl, `/incidents/${incResident.incident_id}/resources`, {
      method: 'POST',
      token: tokenCoord,
      body: { resource_id: resourceB_Id },
    });
    record(17, 'Deploying cross-hub resource returns 400 VALIDATION_ERROR', crossDeployRes.status === 400 && crossDeployRes.body.error === 'VALIDATION_ERROR');

    // T18: Coordinator deploys same-hub resource: 201 Created
    const sameDeployRes = await request(baseUrl, `/incidents/${incResident.incident_id}/resources`, {
      method: 'POST',
      token: tokenCoord,
      body: { resource_id: resourceA_Id },
    });
    record(18, 'Deploying same-hub resource returns 201 Created', sameDeployRes.status === 201 && sameDeployRes.body.resource_id === resourceA_Id);

    // T19: List incidents GET /incidents strictly scoped to actor hub
    const listCoordRes = await request(baseUrl, '/incidents', {
      method: 'GET',
      token: tokenCoord,
    });
    const listCrossRes = await request(baseUrl, '/incidents', {
      method: 'GET',
      token: tokenCross,
    });
    const hubAList = listCoordRes.body;
    const hubBList = listCrossRes.body;
    const listIsolated = Array.isArray(hubAList) &&
      hubAList.every((inc) => inc.hub_id === hubA) &&
      Array.isArray(hubBList) &&
      hubBList.every((inc) => inc.hub_id === hubB);
    record(19, 'GET /incidents list strictly scoped to caller hub', listIsolated);

    // T20: PATCH /incidents/:id — Coordinator updates priority with override reason
    const patchRes = await request(baseUrl, `/incidents/${incResident.incident_id}`, {
      method: 'PATCH',
      token: tokenCoord,
      body: {
        status: 'COORDINATING',
        priority_level: 'critical',
        priority_score: 95,
        reason: 'Severe localized flood risk confirmed',
      },
    });
    const patchedInc = patchRes.body;
    const patchOk = patchRes.status === 200 &&
      patchedInc.status === 'COORDINATING' &&
      patchedInc.priority_level === 'critical';
    record(20, 'Coordinator PATCH /incidents/:id priority override succeeds with audit', patchOk);

    // T21: PATCH /incidents/:id — Resolve incident
    const resolveRes = await request(baseUrl, `/incidents/${incResident.incident_id}`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { status: 'RESOLVED' },
    });
    record(21, 'Coordinator transitions incident to RESOLVED (200 OK)', resolveRes.status === 200 && resolveRes.body.status === 'RESOLVED');

    // T22: Resolved incident redacts coordinates even for assigned helper
    const helperPostResolveRes = await request(baseUrl, `/incidents/${incResident.incident_id}`, {
      method: 'GET',
      token: tokenY,
    });
    const helperPostInc = helperPostResolveRes.body;
    const helperTerminalRedacted = helperPostResolveRes.status === 200 &&
      helperPostInc.location === null &&
      helperPostInc.latitude === null;
    record(22, 'Assigned helper loses coordinates once incident is RESOLVED', helperTerminalRedacted);

    // =========================================================================
    // SECTION 5: HELP REQUESTS (POST, MATCH, PATCH)
    // =========================================================================

    // T23: POST /help-requests creates request linked to incident: 201 Created
    const createReqRes = await request(baseUrl, '/help-requests', {
      method: 'POST',
      token: tokenX,
      body: {
        incident_id: incCoord.incident_id,
        need_type: 'medical',
        urgency: 'high',
        location: 'Shelter Tent 3',
      },
    });
    const helpReq = createReqRes.body;
    const helpReqCreatedOk = createReqRes.status === 201 &&
      helpReq.request_id &&
      helpReq.requested_by === userX.user_id &&
      helpReq.status === 'REQUESTED' &&
      helpReq.location === 'Shelter Tent 3';
    record(23, 'Resident POST /help-requests creates request with location visible to requester', helpReqCreatedOk);

    // T24: Coordinator matches same-hub helper: POST /help-requests/:id/match -> 200 OK
    const matchRes = await request(baseUrl, `/help-requests/${helpReq.request_id}/match`, {
      method: 'POST',
      token: tokenCoord,
      body: { matched_helper_id: userY.user_id },
    });
    const matchedReq = matchRes.body;
    record(24, 'Coordinator POST /help-requests/:id/match transitions to MATCHED', matchRes.status === 200 && matchedReq.status === 'MATCHED' && matchedReq.matched_helper_id === userY.user_id);

    // T25: Matched helper transitions request to IN_PROGRESS: PATCH /help-requests/:id -> 200 OK
    const inProgRes = await request(baseUrl, `/help-requests/${helpReq.request_id}`, {
      method: 'PATCH',
      token: tokenY,
      body: { status: 'IN_PROGRESS' },
    });
    record(25, 'Matched helper PATCH /help-requests/:id transitions to IN_PROGRESS', inProgRes.status === 200 && inProgRes.body.status === 'IN_PROGRESS');

    // T26: Requester transitions request to RESOLVED: PATCH /help-requests/:id -> 200 OK
    const resolveReqRes = await request(baseUrl, `/help-requests/${helpReq.request_id}`, {
      method: 'PATCH',
      token: tokenX,
      body: { status: 'RESOLVED' },
    });
    record(26, 'Requester PATCH /help-requests/:id transitions to RESOLVED', resolveReqRes.status === 200 && resolveReqRes.body.status === 'RESOLVED');

    // T27: Modifying resolved help request rejected: 409 INVALID_STATE
    const conflictReqRes = await request(baseUrl, `/help-requests/${helpReq.request_id}`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { status: 'CANCELLED' },
    });
    record(27, 'Modifying resolved help request rejected with 409 INVALID_STATE', conflictReqRes.status === 409 && conflictReqRes.body.error === 'INVALID_STATE');

    // =========================================================================
    // SECTION 6: SOS EVENTS (POST)
    // =========================================================================

    // T28: Resident creates SOS event: POST /sos-events -> 201 Created
    const createSosRes = await request(baseUrl, '/sos-events', {
      method: 'POST',
      token: tokenZ,
      body: {
        location: 'Basement Stairwell B',
        latitude: 12.9730,
        longitude: 77.5960,
        battery_level: 42,
        accidental_protection_confirmed: true,
      },
    });
    const sosEvent = createSosRes.body;
    const sosCreatedOk = createSosRes.status === 201 &&
      sosEvent.sos_id &&
      sosEvent.triggered_by === userZ.user_id &&
      sosEvent.location === 'Basement Stairwell B' &&
      sosEvent.latitude === 12.9730;
    record(28, 'Resident POST /sos-events creates event with location retained for initiator', sosCreatedOk);

    // =========================================================================
    // SECTION 7: EMERGENCY ALERTS (POST)
    // =========================================================================

    // T29: Coordinator issues single-hub alert: POST /emergency-alerts -> 201 Created
    const alertCreateRes = await request(baseUrl, '/emergency-alerts', {
      method: 'POST',
      token: tokenCoord,
      body: {
        level: 'warning',
        source: 'coordinator',
        affected_area: 'Hub Alpha North Sector',
      },
    });
    const alert = alertCreateRes.body;
    const alertOk = alertCreateRes.status === 201 &&
      alert.alert_id &&
      alert.hub_id === hubA &&
      alert.issuer_id === userCoord.user_id &&
      alert.level === 'warning';
    record(29, 'Coordinator POST /emergency-alerts creates single-hub alert with issuer stamped', alertOk);

    // T30: Coordinator cannot issue alert targeting a foreign hub: 403 FORBIDDEN
    const crossAlertRes = await request(baseUrl, '/emergency-alerts', {
      method: 'POST',
      token: tokenCoord,
      body: {
        target_hub_id: hubB,
        level: 'warning',
        source: 'coordinator',
        affected_area: 'Hub Beta Sector',
      },
    });
    record(30, 'Coordinator POST /emergency-alerts targeting foreign hub returns 403 FORBIDDEN', crossAlertRes.status === 403 && crossAlertRes.body.error === 'FORBIDDEN');

    // =========================================================================
    // SECTION 8: NOTIFICATIONS (GET)
    // =========================================================================

    // T31: Resident GET /notifications returns array scoped to recipient
    const notifRes = await request(baseUrl, '/notifications', {
      method: 'GET',
      token: tokenX,
    });
    record(31, 'Resident GET /notifications returns 200 OK array', notifRes.status === 200 && Array.isArray(notifRes.body));

    // Summary
    console.log('\n========================================');
    console.log('SUMMARY OF PHASE 2H UNIT 4 HTTP ROUTE TESTS:');
    const passCount = results.filter((r) => r.status === 'PASS').length;
    console.log(`TOTAL: ${passCount}/${results.length} PASS`);
    console.log('========================================');

    return passCount === results.length;
  } finally {
    // Safe teardown
    console.log('[Cleanup] Cleaning up emergency test artifacts...');
    if (flagDisabledServer) {
      await closeServer(flagDisabledServer.server);
    }
    if (activeServer) {
      await closeServer(activeServer.server);
    }
    // Restore process environment flag
    process.env.ENABLE_EMERGENCY_ROUTES = 'false';

    if (ctx) {
      const { hubA, hubB } = ctx.hubs;
      const { userX, userCross } = ctx.users;
      if (trackedIncidentIds.length > 0) {
        await query('DELETE FROM priority_overrides WHERE incident_id = ANY($1)', [trackedIncidentIds]);
        await query('DELETE FROM incident_resources WHERE incident_id = ANY($1)', [trackedIncidentIds]);
        await query('DELETE FROM incident_helpers WHERE incident_id = ANY($1)', [trackedIncidentIds]);
      }
      await query('DELETE FROM help_requests WHERE hub_id = ANY($1)', [[hubA, hubB]]);
      await query('DELETE FROM sos_events WHERE hub_id = ANY($1)', [[hubA, hubB]]);
      await query('DELETE FROM incidents WHERE hub_id = ANY($1)', [[hubA, hubB]]);
      await query('DELETE FROM emergency_alerts WHERE hub_id = ANY($1)', [[hubA, hubB]]);
      await query('DELETE FROM resource_inventory WHERE owner_id = ANY($1)', [[userX.user_id, userCross.user_id]]);

      await cleanupTestContext(ctx);
      console.log('[Cleanup] Context teardown complete.');
    }
  }
}

if (require.main === module) {
  runTestSuite()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error('Test execution error:', err);
      process.exit(1);
    });
}

module.exports = { runTestSuite };
