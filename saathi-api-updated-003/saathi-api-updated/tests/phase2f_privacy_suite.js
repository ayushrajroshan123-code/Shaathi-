/**
 * SAATHI Phase 2F Privacy & Serializer Audit Test Suite
 *
 * Verifies:
 *  - Recursive JSON inspection on all responses (success and error)
 *  - Representation Layer 1: Public Resource Discovery (zero owner/storage leakage)
 *  - Representation Layer 2: Requester View (zero private owner contact leakage)
 *  - Representation Layer 3: Owner Inbound Review View (factual trust signals only, zero gamified scores)
 *  - Representation Layer 4: Active Coordination Detail (zero private lot/unit leakage)
 *  - User Lookup Privacy (no resident directory, password_hash scrubbed, counterpart minimal)
 *  - Error Response Security & Envelope Consistency (zero stack traces, zero SQL leakage)
 *  - Complete Resource Availability Lifecycle Consistency
 */

require('dotenv').config();
const { pool, query } = require('../src/db');
const {
  startTestServer,
  stopTestServer,
  setupTestContext,
  cleanupTestContext,
} = require('./test_helper');

/**
 * Recursive JSON key inspector: walks all objects and arrays to detect forbidden keys.
 */
function scanForbiddenKeys(data, forbiddenKeys, currentPath = '') {
  const violations = [];
  if (!data || typeof data !== 'object') return violations;

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      violations.push(...scanForbiddenKeys(item, forbiddenKeys, `${currentPath}[${index}]`));
    });
    return violations;
  }

  for (const [key, value] of Object.entries(data)) {
    const fieldPath = currentPath ? `${currentPath}.${key}` : key;
    if (forbiddenKeys.some((fk) => fk.toLowerCase() === key.toLowerCase())) {
      violations.push({ path: fieldPath, key, value });
    }
    if (value && typeof value === 'object') {
      violations.push(...scanForbiddenKeys(value, forbiddenKeys, fieldPath));
    }
  }

  return violations;
}

async function runPrivacySuite() {
  console.log('========================================================');
  console.log('STARTING SAATHI PHASE 2F PRIVACY & SERIALIZER SUITE');
  console.log('========================================================\n');

  const { baseUrl } = await startTestServer();
  const ctx = await setupTestContext();
  const results = [];

  function record(id, title, pass, details = '') {
    results.push({ id, title, status: pass ? 'PASS' : 'FAIL', details });
    console.log(`[Priv ${id.toString().padStart(2, '0')}] ${title}: ${pass ? 'PASS' : 'FAIL'}${details ? ' - ' + details : ''}`);
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

    // --- SETUP: Create a test resource owned by X in Hub A with sensitive private fields ---
    const resCreate = await api('/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenX}` },
      body: JSON.stringify({
        name: 'Privacy DeWalt Table Saw',
        type: 'tools',
        condition: 'Like New',
        general_area: 'South Commons · Area 2',
        handoff_policy: 'Exchange point at Cafe Courtyard',
        location: 'Private Basement Storage Locker 104', // Private location
      }),
    });
    const resourceId = resCreate.body?.resource_id;

    // =========================================================================
    // 1. LAYER 1: PUBLIC RESOURCE DISCOVERY PRIVACY (Tests 1-3)
    // =========================================================================
    const pubForbidden = [
      'owner_id', 'owner_name', 'owner_phone', 'phone', 'location',
      'storage_location', 'exact_address', 'lot', 'unit',
      'password', 'password_hash', 'security', 'internal_notes',
      'conduct_report', 'risk_score'
    ];

    // GET /resources (List view)
    const pubList = await api('/resources', { method: 'GET', headers: { Authorization: `Bearer ${tokenY}` } });
    const listViolations = scanForbiddenKeys(pubList.body, pubForbidden);
    record(1, 'GET /resources recursively contains zero forbidden keys',
      pubList.status === 200 && Array.isArray(pubList.body) && listViolations.length === 0
    );

    // GET /resources/:id (Detail view by borrower Y)
    const pubDetailY = await api(`/resources/${resourceId}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenY}` } });
    const detailYViolations = scanForbiddenKeys(pubDetailY.body, pubForbidden);
    record(2, 'GET /resources/:id detail view contains zero forbidden keys',
      pubDetailY.status === 200 && detailYViolations.length === 0
    );

    // GET /resources/:id by owner X returns public view (does NOT leak private storage locker)
    const pubDetailX = await api(`/resources/${resourceId}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenX}` } });
    const detailXViolations = scanForbiddenKeys(pubDetailX.body, pubForbidden);
    const leaksLocker = JSON.stringify(pubDetailX.body).includes('Locker 104');
    record(3, 'Owner calling GET /resources/:id receives public projection (no private location leakage)',
      pubDetailX.status === 200 && detailXViolations.length === 0 && !leaksLocker
    );

    // =========================================================================
    // 2. LAYER 2: REQUESTER OUTBOUND VIEW (Tests 4-5)
    // =========================================================================
    // Y creates request
    const reqRes = await api('/resources/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
      body: JSON.stringify({
        resource_id: resourceId,
        purpose: 'Building patio furniture',
        duration: '4 hours',
        time_window_start: new Date(Date.now() + 3600000).toISOString(),
        time_window_end: new Date(Date.now() + 18000000).toISOString(),
      }),
    });
    const requestId = reqRes.body?.request_id;

    // GET /resources/requests/outbound
    const outList = await api('/resources/requests/outbound', { method: 'GET', headers: { Authorization: `Bearer ${tokenY}` } });
    const outForbidden = ['owner_id', 'owner_phone', 'phone', 'location', 'password_hash', 'exact_address'];
    const outViolations = scanForbiddenKeys(outList.body, outForbidden);
    record(4, 'GET /resources/requests/outbound contains zero forbidden keys',
      outList.status === 200 && outViolations.length === 0
    );

    // GET /resources/requests/:id by borrower
    const reqDetailY = await api(`/resources/requests/${requestId}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenY}` } });
    const reqDetailYViolations = scanForbiddenKeys(reqDetailY.body, outForbidden);
    const counterpartDisplaySafe = reqDetailY.body?.counterpart_display === 'Resource Owner (Verified Neighbor)';
    record(5, 'Borrower request detail view contains zero private owner data and safe counterpart display',
      reqDetailY.status === 200 && reqDetailYViolations.length === 0 && counterpartDisplaySafe
    );

    // =========================================================================
    // 3. LAYER 3: OWNER INBOUND REVIEW VIEW (Tests 6-7)
    // =========================================================================
    // GET /resources/requests/inbound by owner X
    const inList = await api('/resources/requests/inbound', { method: 'GET', headers: { Authorization: `Bearer ${tokenX}` } });
    const ownerForbidden = [
      'password_hash', 'phone', 'risk_score', 'reputation_score',
      'stars', 'rating', 'suspicion', 'criminal', 'danger'
    ];
    const inViolations = scanForbiddenKeys(inList.body, ownerForbidden);
    record(6, 'Owner review view contains zero gamified ratings or forbidden fields',
      inList.status === 200 && inViolations.length === 0
    );

    // Validate factual trust signals in owner view
    const targetInReq = inList.body?.find((r) => r.request_id === requestId);
    const trust = targetInReq?.requester_trust;
    const hasOnlyFactualSignals = trust &&
      typeof trust.identity_verified === 'boolean' &&
      typeof trust.neighborhood_verified === 'boolean' &&
      typeof trust.membership_age === 'string' &&
      typeof trust.completed_coordinations === 'number' &&
      typeof trust.no_outstanding_returns === 'boolean' &&
      typeof trust.eligible === 'boolean';
    record(7, 'Requester trust signals strictly limited to factual historical records', hasOnlyFactualSignals);

    // =========================================================================
    // 4. LAYER 4: ACTIVE COORDINATION PRIVACY (Tests 8-9)
    // =========================================================================
    // Owner X approves request -> Coordination created
    const approveRes = await api(`/resources/requests/${requestId}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } });
    const coordId = approveRes.body?.coordination?.coordination_id;

    // GET /coordinations/:id
    const coordDetail = await api(`/coordinations/${coordId}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenY}` } });
    const coordForbidden = ['password_hash', 'exact_address', 'lot', 'unit', 'storage_location'];
    const coordViolations = scanForbiddenKeys(coordDetail.body, coordForbidden);
    record(8, 'Coordination detail contains zero private lot/storage keys',
      coordDetail.status === 200 && coordViolations.length === 0
    );

    // Counterpart display formatting
    const borrowerSeesOwner = coordDetail.body?.counterpart_role === 'Owner' &&
      coordDetail.body?.counterpart_display?.includes('(Verified Neighbor)');
    record(9, 'Coordination counterpart display is formatted safely with verified neighbor moniker', borrowerSeesOwner);

    // =========================================================================
    // 5. USER LOOKUP PRIVACY & DIRECTORY PROTECTION (Tests 10-12)
    // =========================================================================
    // 10. Self lookup has password_hash scrubbed
    const selfLookup = await api(`/users/${userX.user_id}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenX}` } });
    record(10, 'Self user lookup scrubs password_hash completely',
      selfLookup.status === 200 && selfLookup.body?.password_hash === undefined
    );

    // 11. Counterpart lookup (Y looking up X during active coordination) exposes minimal projection only
    const counterpartLookup = await api(`/users/${userX.user_id}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenY}` } });
    const counterpartKeys = Object.keys(counterpartLookup.body || {});
    const isMinimalCounterpart = counterpartLookup.status === 200 &&
      counterpartKeys.every((k) => ['user_id', 'name', 'role'].includes(k));
    record(11, 'Counterpart user lookup returns minimal projection only (user_id, name, role)', isMinimalCounterpart);

    // 12. Unrelated user Z looking up X receives 404 NOT_FOUND (no resident scraping)
    const unrelatedLookup = await api(`/users/${userX.user_id}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenZ}` } });
    record(12, 'Unrelated resident lookup receives 404 NOT_FOUND (prohibits directory scraping)',
      unrelatedLookup.status === 404
    );

    // =========================================================================
    // 6. ERROR RESPONSE ENVELOPE & INFORMATION LEAKAGE (Tests 13-14)
    // =========================================================================
    // Test various 4xx errors for envelope format and zero leakage
    const badReq = await api('/resources/requests', { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` }, body: JSON.stringify({}) });
    const notFoundReq = await api('/resources/00000000-0000-0000-0000-000000000000', { method: 'GET', headers: { Authorization: `Bearer ${tokenY}` } });

    const errorForbidden = ['stack', 'sql', 'query', 'client', 'table', 'column', 'password', 'password_hash'];
    const badReqViolations = scanForbiddenKeys(badReq.body, errorForbidden);
    const notFoundViolations = scanForbiddenKeys(notFoundReq.body, errorForbidden);

    const badReqEnvelope = badReq.body && typeof badReq.body.error === 'string' && typeof badReq.body.message === 'string' && badReq.body.status === 400;
    const notFoundEnvelope = notFoundReq.body && typeof notFoundReq.body.error === 'string' && typeof notFoundReq.body.message === 'string' && notFoundReq.body.status === 404;

    record(13, 'Error responses match standard envelope ({ error, message, status })', badReqEnvelope && notFoundEnvelope);
    record(14, 'Error responses contain zero stack traces, SQL text, or database internals',
      badReqViolations.length === 0 && notFoundViolations.length === 0
    );

    // =========================================================================
    // 7. COMPLETE RESOURCE AVAILABILITY LIFECYCLE (Test 15)
    // =========================================================================
    // Follow the resource availability across all states:
    // 1. Initial: was available before request, remained available when REQUESTED
    // 2. APPROVED: unavailable
    const pubDuringApproved = await api(`/resources/${resourceId}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenZ}` } });
    const unavailApproved = pubDuringApproved.body?.available === false;

    // 3. Move through SCHEDULED -> HANDOFF_READY -> HANDED_OVER -> IN_USE
    await api(`/coordinations/${coordId}/transition`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` }, body: JSON.stringify({ to_state: 'SCHEDULED' }) });
    await api(`/coordinations/${coordId}/transition`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` }, body: JSON.stringify({ to_state: 'HANDOFF_READY' }) });
    await api(`/coordinations/${coordId}/transition`, { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` }, body: JSON.stringify({ to_state: 'HANDED_OVER' }) });
    await api(`/coordinations/${coordId}/transition`, { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` }, body: JSON.stringify({ to_state: 'IN_USE' }) });

    const pubDuringInUse = await api(`/resources/${resourceId}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenZ}` } });
    const unavailInUse = pubDuringInUse.body?.available === false;

    // 4. RETURN_PENDING: still unavailable
    await api(`/coordinations/${coordId}/return/initiate`, { method: 'POST', headers: { Authorization: `Bearer ${tokenY}` } });
    const pubDuringReturnPending = await api(`/resources/${resourceId}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenZ}` } });
    const unavailReturnPending = pubDuringReturnPending.body?.available === false;

    // 5. COMPLETED: restored to available = true
    await api(`/coordinations/${coordId}/return/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${tokenX}` } });
    const pubAfterCompleted = await api(`/resources/${resourceId}`, { method: 'GET', headers: { Authorization: `Bearer ${tokenZ}` } });
    const availCompleted = pubAfterCompleted.body?.available === true;

    record(15, 'Resource availability matches canonical lifecycle (unavailable in active states, restored upon completion)',
      unavailApproved && unavailInUse && unavailReturnPending && availCompleted
    );

  } finally {
    await cleanupTestContext(ctx);
    await stopTestServer();
  }

  const failures = results.filter((r) => r.status === 'FAIL');
  console.log('\n========================================');
  console.log(`SUMMARY OF PHASE 2F PRIVACY SUITE:`);
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
  runPrivacySuite()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Fatal error running Phase 2F privacy suite:', err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { runPrivacySuite };
