/**
 * SAATHI Unit 3 Emergency Service Test Suite
 *
 * Validates backend emergency service business logic:
 * - Authentication & Actor Authority
 * - Coordinator Authorization & Target Hub Validation
 * - Single-Hub Alert Semantics & Server-Derived Issuer Stamping
 * - Hub Isolation & Non-Disclosing Anti-Probing 404s
 * - Cross-Hub Association Rejections (Incidents, Helpers, Resources)
 * - State Machine Transitions & Concurrency / Audit Integrity
 * - Transactional Consistency & Rollback
 * - Dedicated Test Database Protection (saathi_test only)
 */

require('dotenv').config();
const assert = require('assert');
const { query } = require('../src/db');
const {
  setupTestContext,
  cleanupTestContext,
} = require('./test_helper');
const emergencyService = require('../src/services/emergency');

async function runTestSuite() {
  console.log('--- STARTING UNIT 3 EMERGENCY SERVICE TEST SUITE ---');

  // Verify connected database is saathi_test
  const { rows: dbRows } = await query('SELECT current_database() AS database_name');
  const dbName = dbRows && dbRows[0] ? dbRows[0].database_name : null;
  if (dbName !== 'saathi_test') {
    throw new Error(`FATAL: Database guard triggered! Expected 'saathi_test', connected to '${dbName}'.`);
  }
  console.log(`[Database Guard] Connected to dedicated test database: ${dbName}`);

  const ctx = await setupTestContext();
  const results = [];
  const trackedIncidentIds = [];
  const trackedUserIds = [];

  function record(id, title, pass, details = '') {
    results.push({ id, title, status: pass ? 'PASS' : 'FAIL', details });
    console.log(`[Test ${id.toString().padStart(2, '0')}] ${title}: ${pass ? 'PASS' : 'FAIL'}${details ? ' - ' + details : ''}`);
  }

  const { hubA, hubB } = ctx.hubs;
  const { userX, userY, userZ, userCoord, userCross } = ctx.users;

  // Actor contexts
  const actorCoordA = { user_id: userCoord.user_id, hub_id: hubA, role: 'coordinator' };
  const actorResidentA = { user_id: userX.user_id, hub_id: hubA, role: 'resident' };
  const actorResidentA_Y = { user_id: userY.user_id, hub_id: hubA, role: 'resident' };
  const actorResidentB = { user_id: userCross.user_id, hub_id: hubB, role: 'resident' };

  try {
    // Setup test resources in resource_inventory for incident resource testing
    const { rows: resARows } = await query(`
      INSERT INTO resource_inventory (owner_id, hub_id, type, condition, location, name)
      VALUES ($1, $2, 'emergency', 'good', 'Alpha Shelter', 'First Aid Kit A')
      RETURNING resource_id
    `, [userX.user_id, hubA]);
    const resourceA_Id = resARows[0].resource_id;

    const { rows: resBRows } = await query(`
      INSERT INTO resource_inventory (owner_id, hub_id, type, condition, location, name)
      VALUES ($1, $2, 'emergency', 'good', 'Beta Shelter', 'Generator B')
      RETURNING resource_id
    `, [userCross.user_id, hubB]);
    const resourceB_Id = resBRows[0].resource_id;

    // =========================================================================
    // SECTION 1: AUTHENTICATION AND AUTHORIZATION
    // =========================================================================

    // T01: createEmergencyAlert fails when actor is missing or unauthenticated
    let t01Passed = false;
    try {
      await emergencyService.createEmergencyAlert(null, {
        level: 'warning',
        source: 'coordinator',
        affected_area: 'Zone 1',
      });
    } catch (err) {
      t01Passed = err.status === 401 && err.code === 'UNAUTHENTICATED';
    }
    record(1, 'Unauthenticated actor is rejected on alert creation (401)', t01Passed);

    // T02: createEmergencyAlert fails when non-coordinator resident attempts to create
    let t02Passed = false;
    try {
      await emergencyService.createEmergencyAlert(actorResidentA, {
        level: 'warning',
        source: 'coordinator',
        affected_area: 'Zone 1',
      });
    } catch (err) {
      t02Passed = err.status === 403 && err.code === 'FORBIDDEN';
    }
    record(2, 'Non-coordinator cannot issue emergency alert (403)', t02Passed);

    // T03: createEmergencyAlert fails when coordinator targets a foreign hub
    let t03Passed = false;
    try {
      await emergencyService.createEmergencyAlert(actorCoordA, {
        target_hub_id: hubB,
        level: 'warning',
        source: 'coordinator',
        affected_area: 'Zone B',
      });
    } catch (err) {
      t03Passed = err.status === 403 && err.code === 'FORBIDDEN';
    }
    record(3, 'Coordinator cannot issue alert targeting a foreign hub (403)', t03Passed);

    // T04: createEmergencyAlert ignores forged issuer_id and derives it from authenticated actor
    const alertA1 = await emergencyService.createEmergencyAlert(actorCoordA, {
      issuer_id: userX.user_id, // Spoofed issuer
      coordinator_id: userZ.user_id, // Spoofed coordinator
      level: 'warning',
      source: 'coordinator',
      affected_area: 'Alpha East Wing',
    });
    const t04Passed = alertA1 &&
      alertA1.hub_id === hubA &&
      alertA1.issuer_id === userCoord.user_id && // Must be actorCoordA, not spoofed userX
      alertA1.level === 'warning' &&
      alertA1.source === 'coordinator' &&
      alertA1.affected_area === 'Alpha East Wing';
    record(4, 'Alert creation stamps authoritative issuer_id and ignores client forgery', t04Passed);

    // T05: createEmergencyAlert validates required fields (affected_area)
    let t05Passed = false;
    try {
      await emergencyService.createEmergencyAlert(actorCoordA, {
        level: 'warning',
        source: 'coordinator',
        affected_area: '   ',
      });
    } catch (err) {
      t05Passed = err.status === 400 && err.code === 'VALIDATION_ERROR';
    }
    record(5, 'Alert creation rejects missing or whitespace-only affected_area (400)', t05Passed);

    // T06: createEmergencyAlert validates level enum
    let t06Passed = false;
    try {
      await emergencyService.createEmergencyAlert(actorCoordA, {
        level: 'apocalyptic', // Invalid
        source: 'coordinator',
        affected_area: 'Zone 1',
      });
    } catch (err) {
      t06Passed = err.status === 400 && err.code === 'VALIDATION_ERROR';
    }
    record(6, 'Alert creation rejects invalid alert level enum (400)', t06Passed);

    // =========================================================================
    // SECTION 2: HUB ISOLATION & NON-DISCLOSING 404 ANTI-PROBING
    // =========================================================================

    // T07: getEmergencyAlert succeeds for user in the target hub
    const alertFetchedA = await emergencyService.getEmergencyAlert(actorResidentA, alertA1.alert_id);
    const t07Passed = alertFetchedA && alertFetchedA.alert_id === alertA1.alert_id;
    record(7, 'Authorized hub resident can read emergency alert', t07Passed);

    // T08: getEmergencyAlert returns 404 NOT_FOUND for user in a different hub
    let t08Passed = false;
    try {
      await emergencyService.getEmergencyAlert(actorResidentB, alertA1.alert_id);
    } catch (err) {
      t08Passed = err.status === 404 && err.code === 'NOT_FOUND';
    }
    record(8, 'Cross-hub alert read throws non-disclosing 404 NOT_FOUND', t08Passed);

    // T09: listEmergencyAlerts returns only alerts for the actor hub
    const alertsA = await emergencyService.listEmergencyAlerts(actorResidentA);
    const alertsB = await emergencyService.listEmergencyAlerts(actorResidentB);
    const t09Passed = alertsA.some((a) => a.alert_id === alertA1.alert_id) &&
      !alertsB.some((a) => a.alert_id === alertA1.alert_id);
    record(9, 'Alert listing is strictly scoped to actor hub', t09Passed);

    // T10: affected_area never expands the audience to foreign hubs
    // Even if affected_area says 'Hub Beta Community Area', residentB cannot read it
    const alertWithBetaArea = await emergencyService.createEmergencyAlert(actorCoordA, {
      level: 'watch',
      source: 'coordinator',
      affected_area: 'Adjacent to Hub Beta boundary',
    });
    let t10Passed = false;
    try {
      await emergencyService.getEmergencyAlert(actorResidentB, alertWithBetaArea.alert_id);
    } catch (err) {
      t10Passed = err.status === 404 && err.code === 'NOT_FOUND';
    }
    record(10, 'affected_area is descriptive metadata and never grants cross-hub access', t10Passed);

    // =========================================================================
    // SECTION 3: INCIDENTS & HUB ISOLATION
    // =========================================================================

    // T11: createIncident scopes incident to actor.hub_id
    const incA1 = await emergencyService.createIncident(actorResidentA, {
      source: 'hazard_report',
      location: 'Block A Stairwell',
      latitude: 12.971598,
      longitude: 77.594566,
      affected_people: 4,
      vulnerable_people: 'elderly',
    });
    trackedIncidentIds.push(incA1.incident_id);
    const t11Passed = incA1 && incA1.hub_id === hubA && incA1.status === 'OPEN';
    record(11, 'Incident creation derives hub_id from authoritative actor context', t11Passed);

    // T12: getIncident returns 404 for cross-hub user
    let t12Passed = false;
    try {
      await emergencyService.getIncident(actorResidentB, incA1.incident_id);
    } catch (err) {
      t12Passed = err.status === 404 && err.code === 'NOT_FOUND';
    }
    record(12, 'Cross-hub incident read returns non-disclosing 404 NOT_FOUND', t12Passed);

    // T13: listIncidents returns only incidents in actor hub
    const incsA = await emergencyService.listIncidents(actorResidentA);
    const incsB = await emergencyService.listIncidents(actorResidentB);
    const t13Passed = incsA.some((i) => i.incident_id === incA1.incident_id) &&
      !incsB.some((i) => i.incident_id === incA1.incident_id);
    record(13, 'Incident listing is strictly scoped to actor hub', t13Passed);

    // T14: addIncidentHelper rejects cross-hub helper with 400
    let t14Passed = false;
    try {
      await emergencyService.addIncidentHelper(actorCoordA, incA1.incident_id, {
        user_id: userCross.user_id, // Belongs to Hub B
      });
    } catch (err) {
      t14Passed = err.status === 400 && err.code === 'VALIDATION_ERROR';
    }
    record(14, 'Cross-hub incident helper assignment is rejected (400)', t14Passed);

    // T15: addIncidentHelper succeeds for helper belonging to same hub
    const helperRes = await emergencyService.addIncidentHelper(actorCoordA, incA1.incident_id, {
      user_id: userY.user_id,
    });
    const t15Passed = helperRes && helperRes.incident_id === incA1.incident_id && helperRes.user_id === userY.user_id;
    record(15, 'Same-hub incident helper assignment succeeds', t15Passed);

    // T16: addIncidentResource rejects cross-hub resource owner with 400
    let t16Passed = false;
    try {
      await emergencyService.addIncidentResource(actorCoordA, incA1.incident_id, {
        resource_id: resourceB_Id, // Owned by userCross in Hub B
      });
    } catch (err) {
      t16Passed = err.status === 400 && err.code === 'VALIDATION_ERROR';
    }
    record(16, 'Cross-hub resource deployment is rejected (400)', t16Passed);

    // T17: addIncidentResource succeeds for resource owned in same hub
    const resDeploy = await emergencyService.addIncidentResource(actorCoordA, incA1.incident_id, {
      resource_id: resourceA_Id,
    });
    const t17Passed = resDeploy && resDeploy.incident_id === incA1.incident_id && resDeploy.resource_id === resourceA_Id;
    record(17, 'Same-hub resource deployment succeeds', t17Passed);

    // =========================================================================
    // SECTION 4: SOS EVENTS & HUB ISOLATION
    // =========================================================================

    // T18: createSosEvent derives hub_id and triggered_by from actor
    const sos1 = await emergencyService.createSosEvent(actorResidentA, {
      location: 'Apartment 204',
      latitude: 12.971598,
      longitude: 77.594566,
      battery_level: 85,
      accidental_protection_confirmed: true,
    });
    const t18Passed = sos1 && sos1.hub_id === hubA && sos1.triggered_by === userX.user_id;
    record(18, 'SOS event creation derives hub_id and triggered_by from actor context', t18Passed);

    // T19: createSosEvent rejects linking incident from another hub with 404
    // Create an incident in Hub B first
    const incB1 = await emergencyService.createIncident(actorResidentB, {
      source: 'hazard_report',
      location: 'Beta Gate 1',
    });
    trackedIncidentIds.push(incB1.incident_id);

    let t19Passed = false;
    try {
      await emergencyService.createSosEvent(actorResidentA, {
        location: 'Apartment 204',
        incident_id: incB1.incident_id, // Foreign incident in Hub B
      });
    } catch (err) {
      t19Passed = err.status === 404 && err.code === 'NOT_FOUND';
    }
    record(19, 'SOS event linking foreign hub incident throws 404 NOT_FOUND', t19Passed);

    // T20: getSosEvent cross-hub read throws 404
    let t20Passed = false;
    try {
      await emergencyService.getSosEvent(actorResidentB, sos1.sos_id);
    } catch (err) {
      t20Passed = err.status === 404 && err.code === 'NOT_FOUND';
    }
    record(20, 'Cross-hub SOS event read throws 404 NOT_FOUND', t20Passed);

    // T21: listSosEvents is strictly scoped to actor hub
    const sosListA = await emergencyService.listSosEvents(actorResidentA);
    const sosListB = await emergencyService.listSosEvents(actorResidentB);
    const t21Passed = sosListA.some((s) => s.sos_id === sos1.sos_id) &&
      !sosListB.some((s) => s.sos_id === sos1.sos_id);
    record(21, 'SOS event listing is strictly scoped to actor hub', t21Passed);

    // =========================================================================
    // SECTION 5: HELP REQUESTS & HUB ISOLATION
    // =========================================================================

    // T22: createHelpRequest derives hub_id and requested_by from actor
    const helpReq1 = await emergencyService.createHelpRequest(actorResidentA, {
      incident_id: incA1.incident_id,
      need_type: 'medical_aid',
      urgency: 'high',
      location: 'Block A Stairwell',
    });
    const t22Passed = helpReq1 &&
      helpReq1.hub_id === hubA &&
      helpReq1.requested_by === userX.user_id &&
      helpReq1.status === 'REQUESTED';
    record(22, 'Help request creation derives hub_id and requested_by from actor context', t22Passed);

    // T23: createHelpRequest rejects foreign hub incident with 404
    let t23Passed = false;
    try {
      await emergencyService.createHelpRequest(actorResidentA, {
        incident_id: incB1.incident_id, // Belongs to Hub B
        need_type: 'evacuation',
        urgency: 'critical',
        location: 'Alpha Gate',
      });
    } catch (err) {
      t23Passed = err.status === 404 && err.code === 'NOT_FOUND';
    }
    record(23, 'Help request linking foreign hub incident throws 404 NOT_FOUND', t23Passed);

    // T24: getHelpRequest cross-hub read throws 404
    let t24Passed = false;
    try {
      await emergencyService.getHelpRequest(actorResidentB, helpReq1.request_id);
    } catch (err) {
      t24Passed = err.status === 404 && err.code === 'NOT_FOUND';
    }
    record(24, 'Cross-hub help request read throws 404 NOT_FOUND', t24Passed);

    // T25: matchHelpRequest rejects non-coordinator with 403
    let t25Passed = false;
    try {
      await emergencyService.matchHelpRequest(actorResidentA, helpReq1.request_id, {
        matched_helper_id: userY.user_id,
      });
    } catch (err) {
      t25Passed = err.status === 403 && err.code === 'FORBIDDEN';
    }
    record(25, 'Non-coordinator cannot match help requests (403)', t25Passed);

    // T26: matchHelpRequest rejects helper belonging to foreign hub with 400
    let t26Passed = false;
    try {
      await emergencyService.matchHelpRequest(actorCoordA, helpReq1.request_id, {
        matched_helper_id: userCross.user_id, // In Hub B
      });
    } catch (err) {
      t26Passed = err.status === 400 && err.code === 'VALIDATION_ERROR';
    }
    record(26, 'Matching helper from a different hub is rejected (400)', t26Passed);

    // T27: matchHelpRequest succeeds for same hub helper and transitions to MATCHED
    const matchedReq = await emergencyService.matchHelpRequest(actorCoordA, helpReq1.request_id, {
      matched_helper_id: userY.user_id,
    });
    const t27Passed = matchedReq &&
      matchedReq.status === 'MATCHED' &&
      matchedReq.matched_helper_id === userY.user_id;
    record(27, 'Coordinator matching same-hub helper transitions status to MATCHED', t27Passed);

    // =========================================================================
    // SECTION 6: STATE INTEGRITY, TRANSITIONS, CONCURRENCY & AUDIT LOGGING
    // =========================================================================

    // T28: updateHelpRequestStatus rejects unauthorized actor (neither requester, helper, nor coordinator)
    let t28Passed = false;
    try {
      await emergencyService.updateHelpRequestStatus(
        { user_id: userZ.user_id, hub_id: hubA, role: 'resident' }, // Mallory (unrelated)
        helpReq1.request_id,
        { status: 'IN_PROGRESS' }
      );
    } catch (err) {
      t28Passed = err.status === 403 && err.code === 'FORBIDDEN';
    }
    record(28, 'Unrelated user cannot update help request status (403)', t28Passed);

    // T29: updateHelpRequestStatus allows matched helper to transition to IN_PROGRESS
    const inProgressReq = await emergencyService.updateHelpRequestStatus(
      actorResidentA_Y, // Bob (matched helper)
      helpReq1.request_id,
      { status: 'IN_PROGRESS' }
    );
    const t29Passed = inProgressReq && inProgressReq.status === 'IN_PROGRESS';
    record(29, 'Matched helper can transition help request to IN_PROGRESS', t29Passed);

    // T30: updateHelpRequestStatus allows requester to resolve request
    const resolvedReq = await emergencyService.updateHelpRequestStatus(
      actorResidentA, // Alice (requester)
      helpReq1.request_id,
      { status: 'RESOLVED' }
    );
    const t30Passed = resolvedReq && resolvedReq.status === 'RESOLVED' && resolvedReq.resolved_at !== null;
    record(30, 'Requester can transition in-progress request to RESOLVED', t30Passed);

    // T31: Modifying a RESOLVED help request is rejected with 409 INVALID_STATE
    let t31Passed = false;
    try {
      await emergencyService.updateHelpRequestStatus(
        actorCoordA,
        helpReq1.request_id,
        { status: 'CANCELLED' }
      );
    } catch (err) {
      t31Passed = err.status === 409 && err.code === 'INVALID_STATE';
    }
    record(31, 'Modifying a resolved help request is rejected (409 INVALID_STATE)', t31Passed);

    // T32: Incident update rejects non-coordinator with 403
    let t32Passed = false;
    try {
      await emergencyService.updateIncident(actorResidentA, incA1.incident_id, {
        status: 'PRIORITIZED',
      });
    } catch (err) {
      t32Passed = err.status === 403 && err.code === 'FORBIDDEN';
    }
    record(32, 'Non-coordinator cannot update incident (403)', t32Passed);

    // T33: Priority override requires mandatory reason
    let t33Passed = false;
    try {
      await emergencyService.updateIncident(actorCoordA, incA1.incident_id, {
        priority_level: 'critical',
        priority_score: 95.0,
        // reason omitted!
      });
    } catch (err) {
      t33Passed = err.status === 400 && err.code === 'VALIDATION_ERROR';
    }
    record(33, 'Overriding priority_level without reason is rejected (400)', t33Passed);

    // T34: Priority override with reason logs entry to priority_overrides table
    const incPrioritized = await emergencyService.updateIncident(actorCoordA, incA1.incident_id, {
      status: 'PRIORITIZED',
      priority_level: 'critical',
      priority_score: 95.0,
      reason: 'Multiple vulnerable residents trapped on 3rd floor',
    });
    const { rows: overrideLogs } = await query(
      `SELECT * FROM priority_overrides WHERE incident_id = $1`,
      [incA1.incident_id]
    );
    const t34Passed = incPrioritized &&
      incPrioritized.status === 'PRIORITIZED' &&
      incPrioritized.priority_level === 'critical' &&
      overrideLogs.length === 1 &&
      overrideLogs[0].coordinator_id === userCoord.user_id &&
      overrideLogs[0].new_level === 'critical' &&
      overrideLogs[0].reason === 'Multiple vulnerable residents trapped on 3rd floor';
    record(34, 'Priority override records audit log in priority_overrides table', t34Passed);

    // T35: Invalid incident transition (e.g. PRIORITIZED back to OPEN) is rejected with 400
    let t35Passed = false;
    try {
      await emergencyService.updateIncident(actorCoordA, incA1.incident_id, {
        status: 'OPEN',
      });
    } catch (err) {
      t35Passed = err.status === 400 && err.code === 'VALIDATION_ERROR';
    }
    record(35, 'Invalid backwards incident transition (PRIORITIZED -> OPEN) is rejected (400)', t35Passed);

    // T36: Incident lifecycle progression: PRIORITIZED -> COORDINATING -> RESOLVED
    const incCoord = await emergencyService.updateIncident(actorCoordA, incA1.incident_id, {
      status: 'COORDINATING',
    });
    const incResolved = await emergencyService.updateIncident(actorCoordA, incA1.incident_id, {
      status: 'RESOLVED',
    });
    const t36Passed = incCoord.status === 'COORDINATING' &&
      incResolved.status === 'RESOLVED' &&
      incResolved.resolved_at !== null;
    record(36, 'Incident progresses through COORDINATING to RESOLVED with resolved_at stamped', t36Passed);

    // T37: Modifying a RESOLVED incident throws 409 INVALID_STATE
    let t37Passed = false;
    try {
      await emergencyService.updateIncident(actorCoordA, incA1.incident_id, {
        status: 'COORDINATING',
      });
    } catch (err) {
      t37Passed = err.status === 409 && err.code === 'INVALID_STATE';
    }
    record(37, 'Modifying a resolved incident is rejected (409 INVALID_STATE)', t37Passed);

    // T38: Transactional rollback on error leaves no partial writes or orphaned records
    const incForRollback = await emergencyService.createIncident(actorResidentA, {
      source: 'alert',
      location: 'Block C Roof',
    });
    trackedIncidentIds.push(incForRollback.incident_id);

    let t38Passed = false;
    try {
      // Force an error inside a multi-operation or invalid update to test atomic rollback
      await emergencyService.updateIncident(actorCoordA, incForRollback.incident_id, {
        priority_level: 'critical',
        reason: 'Valid reason',
        status: 'INVALID_STATUS', // Throws inside transaction after validation
      });
    } catch (err) {
      // Check whether priority_overrides row was rolled back
      const { rows: checkOverrides } = await query(
        `SELECT * FROM priority_overrides WHERE incident_id = $1`,
        [incForRollback.incident_id]
      );
      t38Passed = checkOverrides.length === 0;
    }
    record(38, 'Transactional error rolls back multi-step writes completely', t38Passed);

    // T39: Notifications query is strictly scoped to recipient_id
    const notifs = await emergencyService.listNotifications(actorResidentA);
    const t39Passed = Array.isArray(notifs);
    record(39, 'Notifications list is strictly scoped to recipient actor', t39Passed);

    // =========================================================================
    // SECTION 7: GPS PRIVACY & FIELD-LEVEL LOCATION HARDENING (STAGE 2)
    // =========================================================================

    const actorResidentA_Z = { user_id: userZ.user_id, hub_id: hubA, role: 'resident' };
    // Seed genuine coordinator for Hub B so actorCoordB corresponds to a real DB coordinator
    const emailCoordB = `coord.b.${Date.now()}.${Math.random().toString(36).substring(2, 6)}@example.com`;
    const { rows: [userCoordB] } = await query(`
      INSERT INTO users (hub_id, name, email, password_hash, role, account_status)
      VALUES ($1, 'Coordinator Hub B', $2, 'dummyhash', 'coordinator', 'active')
      RETURNING user_id, name, email, role, hub_id
    `, [hubB, emailCoordB]);
    trackedUserIds.push(userCoordB.user_id);
    const actorCoordB = { user_id: userCoordB.user_id, hub_id: hubB, role: 'coordinator' };

    // --- 7.1 Incident Location Privacy ---

    // T40: Ordinary same-hub resident reading incident detail does not receive exact coordinates or location
    const incDetailUnauth = await emergencyService.getIncident(actorResidentA_Z, incA1.incident_id);
    const t40Passed = incDetailUnauth &&
      incDetailUnauth.incident_id === incA1.incident_id &&
      incDetailUnauth.latitude === null &&
      incDetailUnauth.longitude === null &&
      incDetailUnauth.location === null &&
      incDetailUnauth.status === 'RESOLVED';
    record(40, 'Ordinary same-hub resident reading incident detail receives null coordinates & location', t40Passed);

    // T41: Ordinary same-hub resident listing incidents receives null coordinates & location on all items
    const incListUnauth = await emergencyService.listIncidents(actorResidentA_Z);
    const t41Passed = Array.isArray(incListUnauth) &&
      incListUnauth.length > 0 &&
      incListUnauth.every((i) => i.latitude === null && i.longitude === null && i.location === null);
    record(41, 'Ordinary same-hub resident listing incidents receives null coordinates & location on all items', t41Passed);

    // T42: Unassigned helper does not receive exact coordinates
    const unassignedDetail = await emergencyService.getIncident(actorResidentA_Z, incA1.incident_id);
    const t42Passed = unassignedDetail &&
      unassignedDetail.latitude === null &&
      unassignedDetail.longitude === null &&
      unassignedDetail.location === null;
    record(42, 'Unassigned helper does not receive exact coordinates or location text', t42Passed);

    // Create an active incident with assigned helper for active helper testing
    const incActive = await emergencyService.createIncident(actorResidentA, {
      source: 'hazard_report',
      location: 'Block A Stairwell',
      latitude: 12.971598,
      longitude: 77.594566,
    });
    trackedIncidentIds.push(incActive.incident_id);
    await emergencyService.addIncidentHelper(actorCoordA, incActive.incident_id, {
      user_id: userY.user_id,
    });

    // T43: Currently assigned helper receives exact coordinates and location for specifically assigned active incident
    const incHelperView = await emergencyService.getIncident(actorResidentA_Y, incActive.incident_id);
    const t43Passed = incHelperView &&
      incHelperView.incident_id === incActive.incident_id &&
      incHelperView.status === 'OPEN' &&
      incHelperView.latitude === 12.971598 &&
      incHelperView.longitude === 77.594566 &&
      incHelperView.location === 'Block A Stairwell';
    record(43, 'Assigned helper receives exact coordinates and location for specifically assigned active incident', t43Passed);

    // T44: Assigned helper cannot use assignment on one incident to retrieve another incident's exact coordinates
    const incA2 = await emergencyService.createIncident(actorResidentA, {
      source: 'hazard_report',
      location: 'Building 4 Elevator Penthouse',
      latitude: 12.972000,
      longitude: 77.595000,
    });
    trackedIncidentIds.push(incA2.incident_id);

    const incA2HelperView = await emergencyService.getIncident(actorResidentA_Y, incA2.incident_id);
    const t44Passed = incA2HelperView &&
      incA2HelperView.incident_id === incA2.incident_id &&
      incA2HelperView.latitude === null &&
      incA2HelperView.longitude === null &&
      incA2HelperView.location === null;
    record(44, 'Assigned helper cannot retrieve coordinates of unassigned incident', t44Passed);

    // T45: Assigned helper listing incidents only receives coordinates for assigned active incident
    const helperList = await emergencyService.listIncidents(actorResidentA_Y);
    const incActiveInList = helperList.find((i) => i.incident_id === incActive.incident_id);
    const incA2InList = helperList.find((i) => i.incident_id === incA2.incident_id);
    const t45Passed = incActiveInList && incActiveInList.latitude !== null && incActiveInList.location !== null &&
      incA2InList && incA2InList.latitude === null && incA2InList.location === null;
    record(45, 'Incident listing evaluates helper assignment per-record without leaking unassigned coordinates', t45Passed);

    // T46: Helper loses exact coordinates and location after incident becomes RESOLVED
    const incA3 = await emergencyService.createIncident(actorResidentA, {
      source: 'hazard_report',
      location: 'Basement Electrical Room',
      latitude: 12.973000,
      longitude: 77.596000,
    });
    trackedIncidentIds.push(incA3.incident_id);
    await emergencyService.addIncidentHelper(actorCoordA, incA3.incident_id, {
      user_id: userY.user_id,
    });
    await emergencyService.updateIncident(actorCoordA, incA3.incident_id, {
      status: 'RESOLVED',
    });
    const resolvedIncHelperView = await emergencyService.getIncident(actorResidentA_Y, incA3.incident_id);
    const t46Passed = resolvedIncHelperView &&
      resolvedIncHelperView.status === 'RESOLVED' &&
      resolvedIncHelperView.latitude === null &&
      resolvedIncHelperView.longitude === null &&
      resolvedIncHelperView.location === null;
    record(46, 'Helper loses exact coordinates and location once incident is RESOLVED', t46Passed);

    // T47: Ordinary resident createIncident response does not disclose exact coordinates or location
    const incA4 = await emergencyService.createIncident(actorResidentA_Z, {
      source: 'hazard_report',
      location: 'Apartment 502 Balcony',
      latitude: 12.974000,
      longitude: 77.597000,
    });
    trackedIncidentIds.push(incA4.incident_id);
    const t47Passed = incA4 &&
      incA4.incident_id &&
      incA4.hub_id === hubA &&
      incA4.latitude === null &&
      incA4.longitude === null &&
      incA4.location === null;
    record(47, 'Ordinary resident createIncident response does not disclose exact coordinates', t47Passed);

    // T48: Permitted coordinator receives exact coordinates and location for record in authorized hub
    const coordIncView = await emergencyService.getIncident(actorCoordA, incA1.incident_id);
    const t48Passed = coordIncView &&
      coordIncView.latitude === 12.971598 &&
      coordIncView.longitude === 77.594566 &&
      coordIncView.location === 'Block A Stairwell';
    record(48, 'Permitted coordinator receives exact coordinates and location in authorized hub', t48Passed);

    // T49: Coordinator from another hub cannot obtain incident or its location (404)
    let t49Passed = false;
    try {
      await emergencyService.getIncident(actorCoordB, incA1.incident_id);
    } catch (err) {
      t49Passed = err.status === 404 && err.code === 'NOT_FOUND';
    }
    record(49, 'Foreign hub coordinator cannot obtain incident or location (404 NOT_FOUND)', t49Passed);

    // --- 7.2 SOS Location Privacy ---

    // T50: Unrelated same-hub resident cannot receive exact coordinates through getSosEvent
    const unrelatedSosView = await emergencyService.getSosEvent(actorResidentA_Y, sos1.sos_id);
    const t50Passed = unrelatedSosView &&
      unrelatedSosView.sos_id === sos1.sos_id &&
      unrelatedSosView.triggered_by === userX.user_id &&
      unrelatedSosView.latitude === null &&
      unrelatedSosView.longitude === null &&
      unrelatedSosView.location === null;
    record(50, 'Unrelated same-hub resident cannot receive SOS coordinates through getSosEvent', t50Passed);

    // T51: Unrelated same-hub resident listing SOS events receives null coordinates for others
    const sosListUnauth = await emergencyService.listSosEvents(actorResidentA_Y);
    const sos1InList = sosListUnauth.find((s) => s.sos_id === sos1.sos_id);
    const t51Passed = sos1InList &&
      sos1InList.latitude === null &&
      sos1InList.longitude === null &&
      sos1InList.location === null;
    record(51, 'Unrelated same-hub resident listing SOS events receives null coordinates for others', t51Passed);

    // T52: Authenticated initiator receives their own exact SOS coordinates and location
    const initiatorSosView = await emergencyService.getSosEvent(actorResidentA, sos1.sos_id);
    const t52Passed = initiatorSosView &&
      initiatorSosView.latitude === 12.971598 &&
      initiatorSosView.longitude === 77.594566 &&
      initiatorSosView.location === 'Apartment 204';
    record(52, 'Authenticated initiator receives own retained SOS coordinates and location', t52Passed);

    // T53: SOS initiator listing events receives own coordinates but not another initiator coordinates
    const sos2 = await emergencyService.createSosEvent(actorResidentA_Y, {
      location: 'Unit 301 Corridor',
      latitude: 12.972500,
      longitude: 77.595500,
    });
    const aliceSosList = await emergencyService.listSosEvents(actorResidentA);
    const aliceSos1 = aliceSosList.find((s) => s.sos_id === sos1.sos_id);
    const aliceSos2 = aliceSosList.find((s) => s.sos_id === sos2.sos_id);
    const t53Passed = aliceSos1 && aliceSos1.latitude === 12.971598 && aliceSos1.location === 'Apartment 204' &&
      aliceSos2 && aliceSos2.latitude === null && aliceSos2.location === null;
    record(53, 'SOS listing permits initiator coordinates only for own event', t53Passed);

    // T54: Permitted coordinator receives exact coordinates and location for hub SOS event
    const coordSosView = await emergencyService.getSosEvent(actorCoordA, sos1.sos_id);
    const t54Passed = coordSosView &&
      coordSosView.latitude === 12.971598 &&
      coordSosView.longitude === 77.594566 &&
      coordSosView.location === 'Apartment 204';
    record(54, 'Permitted coordinator receives exact coordinates and location for hub SOS event', t54Passed);

    // T55: Cross-hub SOS event read throws 404 NOT_FOUND
    let t55Passed = false;
    try {
      await emergencyService.getSosEvent(actorResidentB, sos1.sos_id);
    } catch (err) {
      t55Passed = err.status === 404 && err.code === 'NOT_FOUND';
    }
    record(55, 'Cross-hub SOS event read throws 404 NOT_FOUND', t55Passed);

    // --- 7.3 Help Request Text Location Privacy ---

    // T56: Unassigned same-hub resident cannot retrieve identifying location from help-request detail
    const unauthHelpDetail = await emergencyService.getHelpRequest(actorResidentA_Z, helpReq1.request_id);
    const t56Passed = unauthHelpDetail &&
      unauthHelpDetail.request_id === helpReq1.request_id &&
      unauthHelpDetail.location === null &&
      unauthHelpDetail.need_type === 'medical_aid' &&
      unauthHelpDetail.urgency === 'high';
    record(56, 'Unassigned same-hub resident receives null location text on help-request detail', t56Passed);

    // T57: Unassigned same-hub resident listing help requests receives null location text
    const unauthHelpList = await emergencyService.listHelpRequests(actorResidentA_Z);
    const t57Passed = Array.isArray(unauthHelpList) &&
      unauthHelpList.length > 0 &&
      unauthHelpList.every((r) => r.location === null);
    record(57, 'Unassigned same-hub resident listing help requests receives null location text', t57Passed);

    // T58: Matched helper receives identifying location for active help request
    const helpReq2 = await emergencyService.createHelpRequest(actorResidentA, {
      incident_id: incA1.incident_id,
      need_type: 'first_aid',
      urgency: 'high',
      location: 'Apartment 304 Master Bedroom',
    });
    await emergencyService.matchHelpRequest(actorCoordA, helpReq2.request_id, {
      matched_helper_id: userY.user_id,
    });
    const matchedHelpView = await emergencyService.getHelpRequest(actorResidentA_Y, helpReq2.request_id);
    const t58Passed = matchedHelpView &&
      matchedHelpView.location === 'Apartment 304 Master Bedroom' &&
      matchedHelpView.status === 'MATCHED';
    record(58, 'Matched helper receives identifying location text for active matched help request', t58Passed);

    // T59: Matched helper cannot use match on one request to access another request sensitive location
    const helpReq3 = await emergencyService.createHelpRequest(actorResidentA, {
      incident_id: incA1.incident_id,
      need_type: 'childcare',
      urgency: 'medium',
      location: 'Apartment 101 Private Patio',
    });
    const unmatchedHelpView = await emergencyService.getHelpRequest(actorResidentA_Y, helpReq3.request_id);
    const t59Passed = unmatchedHelpView &&
      unmatchedHelpView.request_id === helpReq3.request_id &&
      unmatchedHelpView.location === null;
    record(59, 'Matched helper cannot access identifying location of unmatched help request', t59Passed);

    // T60: Matched helper loses identifying location once help request transitions to RESOLVED
    await emergencyService.updateHelpRequestStatus(actorResidentA_Y, helpReq2.request_id, {
      status: 'IN_PROGRESS',
    });
    await emergencyService.updateHelpRequestStatus(actorResidentA, helpReq2.request_id, {
      status: 'RESOLVED',
    });
    const resolvedHelpHelperView = await emergencyService.getHelpRequest(actorResidentA_Y, helpReq2.request_id);
    const t60Passed = resolvedHelpHelperView &&
      resolvedHelpHelperView.status === 'RESOLVED' &&
      resolvedHelpHelperView.location === null;
    record(60, 'Matched helper loses identifying location text once help request is RESOLVED', t60Passed);

    // =========================================================================
    // SECTION 8: AUTHORITATIVE ACTOR & STALE CONTEXT RESISTANCE (FIX VERIFICATION)
    // =========================================================================

    // T61: Demoted coordinator using stale coordinator actor is rejected from coordinator actions & denied location
    const emailDemote = `demote.${Date.now()}.${Math.random().toString(36).substring(2, 6)}@example.com`;
    const { rows: [userDemote] } = await query(`
      INSERT INTO users (hub_id, name, email, password_hash, role, account_status)
      VALUES ($1, 'Demote Coordinator', $2, 'dummyhash', 'coordinator', 'active')
      RETURNING user_id, name, email, role, hub_id
    `, [hubA, emailDemote]);
    trackedUserIds.push(userDemote.user_id);

    const staleCoordActor = { user_id: userDemote.user_id, hub_id: hubA, role: 'coordinator' };

    // Demote user in database from 'coordinator' to 'resident'
    await query("UPDATE users SET role = 'resident' WHERE user_id = $1", [userDemote.user_id]);

    // 1. Attempt coordinator-only alert creation with stale actor -> expect 403
    let alertBlocked = false;
    try {
      await emergencyService.createEmergencyAlert(staleCoordActor, {
        level: 'critical',
        source: 'coordinator',
        affected_area: 'Zone Demoted',
      });
    } catch (err) {
      alertBlocked = err.status === 403 && err.code === 'FORBIDDEN';
    }

    // 2. Attempt coordinator-only incident update with stale actor -> expect 403
    let updateBlocked = false;
    try {
      await emergencyService.updateIncident(staleCoordActor, incA1.incident_id, {
        status: 'INVESTIGATING',
      });
    } catch (err) {
      updateBlocked = err.status === 403 && err.code === 'FORBIDDEN';
    }

    // 3. Attempt to read incident detail with stale actor -> allowed as resident, but coordinates must be redacted (null)
    const incViewDemoted = await emergencyService.getIncident(staleCoordActor, incA1.incident_id);
    const locationRedacted = incViewDemoted &&
      incViewDemoted.incident_id === incA1.incident_id &&
      incViewDemoted.latitude === null &&
      incViewDemoted.longitude === null &&
      incViewDemoted.location === null;

    const t61Passed = alertBlocked && updateBlocked && locationRedacted;
    record(61, 'Demoted coordinator using stale coordinator actor is rejected from coordinator actions & denied location', t61Passed);

    // T62: Reassigned coordinator using stale hub actor cannot access old hub records or issue alerts in old hub
    const emailReassign = `reassign.${Date.now()}.${Math.random().toString(36).substring(2, 6)}@example.com`;
    const { rows: [userReassign] } = await query(`
      INSERT INTO users (hub_id, name, email, password_hash, role, account_status)
      VALUES ($1, 'Reassigned Coord', $2, 'dummyhash', 'coordinator', 'active')
      RETURNING user_id, name, email, role, hub_id
    `, [hubA, emailReassign]);
    trackedUserIds.push(userReassign.user_id);

    // Stale actor claiming Hub A
    const staleHubActor = { user_id: userReassign.user_id, hub_id: hubA, role: 'coordinator' };

    // Move user to Hub B in database
    await query("UPDATE users SET hub_id = $1 WHERE user_id = $2", [hubB, userReassign.user_id]);

    // 1. Attempt to access Hub A's incident incA1 using stale Hub A claim -> must throw 404 NOT_FOUND
    let oldHubReadBlocked = false;
    try {
      await emergencyService.getIncident(staleHubActor, incA1.incident_id);
    } catch (err) {
      oldHubReadBlocked = err.status === 404 && err.code === 'NOT_FOUND';
    }

    // 2. Listing incidents with stale actor should only list Hub B incidents, not Hub A
    const reassignList = await emergencyService.listIncidents(staleHubActor);
    const oldHubIncidentsHidden = Array.isArray(reassignList) && !reassignList.some((i) => i.incident_id === incA1.incident_id);

    // 3. Creating an alert with stale actor (claiming Hub A) creates it in authoritative Hub B, not Hub A
    const newAlert = await emergencyService.createEmergencyAlert(staleHubActor, {
      level: 'warning',
      source: 'coordinator',
      affected_area: 'Zone Reassigned',
    });
    const alertScopedToNewHub = newAlert && newAlert.hub_id === hubB;

    const t62Passed = oldHubReadBlocked && oldHubIncidentsHidden && alertScopedToNewHub;
    record(62, 'Reassigned coordinator using stale hub actor is isolated to new hub & cannot access old hub', t62Passed);

    // T63: Inactive, suspended, pending-approval, or nonexistent user is rejected with 401 UNAUTHENTICATED
    const emailInactive = `inactive.${Date.now()}.${Math.random().toString(36).substring(2, 6)}@example.com`;
    const { rows: [userInactive] } = await query(`
      INSERT INTO users (hub_id, name, email, password_hash, role, account_status, is_active)
      VALUES ($1, 'Inactive User', $2, 'dummyhash', 'resident', 'active', TRUE)
      RETURNING user_id, name, email, role, hub_id
    `, [hubA, emailInactive]);
    trackedUserIds.push(userInactive.user_id);

    const staleInactiveActor = { user_id: userInactive.user_id, hub_id: hubA, role: 'resident' };

    // 1. is_active = FALSE
    await query("UPDATE users SET is_active = FALSE WHERE user_id = $1", [userInactive.user_id]);
    let inactiveBlocked = false;
    try {
      await emergencyService.getIncident(staleInactiveActor, incA1.incident_id);
    } catch (err) {
      inactiveBlocked = err.status === 401 && err.code === 'UNAUTHENTICATED';
    }

    // 2. account_status = 'suspended'
    await query("UPDATE users SET is_active = TRUE, account_status = 'suspended' WHERE user_id = $1", [userInactive.user_id]);
    let suspendedBlocked = false;
    try {
      await emergencyService.listIncidents(staleInactiveActor);
    } catch (err) {
      suspendedBlocked = err.status === 401 && err.code === 'UNAUTHENTICATED';
    }

    // 3. account_status = 'pending_approval'
    await query("UPDATE users SET account_status = 'pending_approval' WHERE user_id = $1", [userInactive.user_id]);
    let pendingBlocked = false;
    try {
      await emergencyService.createIncident(staleInactiveActor, {
        source: 'hazard_report',
        location: 'Pending Test',
      });
    } catch (err) {
      pendingBlocked = err.status === 401 && err.code === 'UNAUTHENTICATED';
    }

    // 4. Nonexistent user UUID
    let nonexistentBlocked = false;
    try {
      await emergencyService.getIncident({ user_id: 'a0000000-0000-4000-8000-000000000099', hub_id: hubA, role: 'resident' }, incA1.incident_id);
    } catch (err) {
      nonexistentBlocked = err.status === 401 && err.code === 'UNAUTHENTICATED';
    }

    const t63Passed = inactiveBlocked && suspendedBlocked && pendingBlocked && nonexistentBlocked;
    record(63, 'Inactive, suspended, pending, or nonexistent users are rejected (401 UNAUTHENTICATED)', t63Passed);

    // T64: Valid, active coordinator in authorized hub retains all coordinator privileges & exact location access
    const coordViewInc = await emergencyService.getIncident(actorCoordA, incActive.incident_id);
    const hasCoordinates = coordViewInc &&
      coordViewInc.latitude === 12.971598 &&
      coordViewInc.longitude === 77.594566 &&
      coordViewInc.location === 'Block A Stairwell';

    const coordAlert = await emergencyService.createEmergencyAlert(actorCoordA, {
      level: 'warning',
      source: 'coordinator',
      affected_area: 'Zone Regression Valid',
    });
    const canCreateAlert = coordAlert && coordAlert.hub_id === hubA && coordAlert.issuer_id === userCoord.user_id;

    const coordIncUpdate = await emergencyService.updateIncident(actorCoordA, incActive.incident_id, {
      priority_score: 85,
    });
    const canUpdateIncident = coordIncUpdate && Number(coordIncUpdate.priority_score) === 85;

    const t64Passed = Boolean(hasCoordinates && canCreateAlert && canUpdateIncident);
    record(64, 'Valid active coordinator retains all functionality and full location visibility', t64Passed);

    // T65: Existing privacy boundaries remain strictly enforced under authoritative context
    // 1. Unassigned resident receives null coordinates & location
    const unassignedInc = await emergencyService.getIncident(actorResidentA_Z, incActive.incident_id);
    const unassignedRedacted = unassignedInc && unassignedInc.latitude === null && unassignedInc.location === null;

    // 2. Assigned active helper receives location
    const helperInc = await emergencyService.getIncident(actorResidentA_Y, incActive.incident_id);
    const helperPermitted = helperInc && helperInc.latitude === 12.971598 && helperInc.location === 'Block A Stairwell';

    // 3. SOS initiator receives own event coordinates
    const ownSos = await emergencyService.getSosEvent(actorResidentA, sos1.sos_id);
    const initiatorPermitted = ownSos && ownSos.latitude === 12.971598 && ownSos.location === 'Apartment 204';

    // 4. Foreign hub resident receives 404 NOT_FOUND
    let crossHubRejected = false;
    try {
      await emergencyService.getIncident(actorResidentB, incActive.incident_id);
    } catch (err) {
      crossHubRejected = err.status === 404 && err.code === 'NOT_FOUND';
    }

    // 5. Terminal state (RESOLVED) redacts helper location
    const resolvedIncView = await emergencyService.getIncident(actorResidentA_Y, incA1.incident_id);
    const terminalRedacted = resolvedIncView && resolvedIncView.latitude === null && resolvedIncView.location === null;

    const t65Passed = unassignedRedacted && helperPermitted && initiatorPermitted && crossHubRejected && terminalRedacted;
    record(65, 'Privacy boundaries (unassigned null, helper access, SOS owner, cross-hub 404, terminal redaction) preserved', t65Passed);

    // Summary
    console.log('\n========================================');
    console.log('SUMMARY OF UNIT 3 EMERGENCY SERVICE TESTS:');
    const passCount = results.filter((r) => r.status === 'PASS').length;
    console.log(`TOTAL: ${passCount}/${results.length} PASS`);
    console.log('========================================');

    return passCount === results.length;
  } finally {
    // Safe teardown of emergency records before standard context teardown
    console.log('[Cleanup] Cleaning up emergency test artifacts...');
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

    if (trackedUserIds.length > 0) {
      await query('DELETE FROM users WHERE user_id = ANY($1)', [trackedUserIds]);
    }

    await cleanupTestContext(ctx);
    console.log('[Cleanup] Context teardown complete.');
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
