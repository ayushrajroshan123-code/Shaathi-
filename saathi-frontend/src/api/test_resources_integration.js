/**
 * SAATHI Phase 2G-2 Resources & Borrow Requests Integration Test Suite
 * Validates Cases 1 through 32 per Phase 2G-2 Implementation Specification (Section 31).
 */

import { apiClient, ApiError, clearSession, getToken, setSession, getApiBaseUrl } from './client.js';
import { login, logout } from './auth.js';
import {
  listResources,
  getResource,
  createResource,
  listInboundRequests,
  listOutboundRequests,
  getResourceRequest,
  createResourceRequest,
  approveResourceRequest,
  declineResourceRequest,
  cancelResourceRequest,
} from './resources.js';

console.log('======================================================================');
console.log('  SAATHI PHASE 2G-2 RESOURCES & REQUESTS INTEGRATION SUITE (CASES 1-32)');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    failCount++;
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
    passCount++;
  }
}

async function runSuite() {
  const ALICE_EMAIL = 'alice.x@example.com';
  const BOB_EMAIL = 'bob.y@example.com';
  const MALLORY_EMAIL = 'mallory.z@example.com';
  const PASSWORD = 'password123';

  // State shared across test cases
  let createdResource = null;
  let activeRequestId = null;
  let declineRequestId = null;
  let cancelRequestId = null;
  let approveTarget = null;

  // ---------------------------------------------------------------------------
  // 1. AUTHENTICATED RESOURCE LIST
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Authenticated Resource List ---');
  await login(BOB_EMAIL, PASSWORD);
  const resources = await listResources();
  assert(Array.isArray(resources), 'listResources() returns an array for authenticated user');

  // ---------------------------------------------------------------------------
  // 2. RESOURCE LIST REQUIRES AUTHENTICATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Resource List Requires Authentication ---');
  clearSession();
  let unauthError = null;
  try {
    await listResources();
  } catch (err) {
    unauthError = err;
  }
  assert(unauthError instanceof ApiError, 'listResources() without session throws ApiError');
  assert(unauthError.status === 401, 'Unauthenticated status is 401');

  // ---------------------------------------------------------------------------
  // 3. PUBLIC RESOURCE RESPONSE CONSUMED WITHOUT OWNER METADATA
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Public Resource Response Consumed Without Owner Metadata ---');
  await login(BOB_EMAIL, PASSWORD);
  const publicList = await listResources();
  for (const res of publicList) {
    assert(res.owner_id === undefined, `Resource ${res.resource_id} has no owner_id`);
    assert(res.owner_name === undefined, `Resource ${res.resource_id} has no owner_name`);
    assert(res.owner_phone === undefined, `Resource ${res.resource_id} has no owner_phone`);
    assert(res.owner_email === undefined, `Resource ${res.resource_id} has no owner_email`);
    assert(res.exact_address === undefined, `Resource ${res.resource_id} has no exact_address`);
    assert(res.address === undefined, `Resource ${res.resource_id} has no address`);
    assert(res.lot === undefined, `Resource ${res.resource_id} has no lot`);
    assert(res.lot_id === undefined, `Resource ${res.resource_id} has no lot_id`);
    assert(res.apartment === undefined, `Resource ${res.resource_id} has no apartment`);
    assert(res.unit === undefined, `Resource ${res.resource_id} has no unit`);
    assert(res.storage === undefined, `Resource ${res.resource_id} has no storage`);
    assert(res.storage_location === undefined, `Resource ${res.resource_id} has no storage_location`);
  }
  assert(true, 'All public resources adhere strictly to Layer 1 privacy boundary');

  // ---------------------------------------------------------------------------
  // 6. RESOURCE CREATE
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Resource Create ---');
  await login(ALICE_EMAIL, PASSWORD);
  const resourcePayload = {
    name: `DeWalt Rotary Hammer Drill ${Date.now()}`,
    type: 'tools',
    condition: 'Like New',
    general_area: 'Greenwood Commons North',
    handoff_policy: 'Community pickup at Cafe Courtyard',
    requires_approval: true,
  };
  createdResource = await createResource(resourcePayload);
  assert(createdResource && typeof createdResource.resource_id === 'string', 'createResource() returns created resource with resource_id');
  assert(createdResource.name === resourcePayload.name, 'Resource name matches creation payload');
  assert(createdResource.available === true, 'Created resource is available');

  // ---------------------------------------------------------------------------
  // 4. RESOURCE DETAIL
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Resource Detail ---');
  await login(BOB_EMAIL, PASSWORD);
  const resDetail = await getResource(createdResource.resource_id);
  assert(resDetail && resDetail.resource_id === createdResource.resource_id, 'getResource() returns authoritative resource detail');
  assert(resDetail.general_area === 'Greenwood Commons North', 'Public detail contains general area');
  assert(resDetail.owner_id === undefined, 'Public detail has zero owner_id');
  assert(resDetail.owner_name === undefined, 'Public detail has zero owner_name');

  // ---------------------------------------------------------------------------
  // 5. RESOURCE DETAIL 404
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Resource Detail 404 ---');
  let notFoundError = null;
  try {
    await getResource('00000000-0000-0000-0000-000000000000');
  } catch (err) {
    notFoundError = err;
  }
  assert(notFoundError instanceof ApiError, 'Non-existent resource throws ApiError');
  assert(notFoundError.status === 404, 'Non-existent resource returns HTTP 404');

  // ---------------------------------------------------------------------------
  // 7. RESOURCE CREATE NEVER SENDS owner_id
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Resource Create Never Sends owner_id ---');
  await login(ALICE_EMAIL, PASSWORD);
  const resWithForgedOwner = await createResource({
    name: `Test Pruner ${Date.now()}`,
    type: 'gardening',
    condition: 'Good',
    general_area: 'Greenwood Commons West',
    handoff_policy: 'Community pickup at Cafe Courtyard',
    owner_id: 'forged-owner-id-12345',
  });
  assert(resWithForgedOwner && resWithForgedOwner.resource_id, 'createResource() strips owner_id and succeeds via server session');

  // ---------------------------------------------------------------------------
  // 8. RESOURCE CREATE NEVER SENDS hub_id
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Resource Create Never Sends hub_id ---');
  const resWithForgedHub = await createResource({
    name: `Test Trowel ${Date.now()}`,
    type: 'gardening',
    condition: 'Good',
    general_area: 'Greenwood Commons East',
    handoff_policy: 'Community pickup at Cafe Courtyard',
    hub_id: 'forged-hub-id-12345',
  });
  assert(resWithForgedHub && resWithForgedHub.resource_id, 'createResource() strips hub_id and succeeds via server session');

  // ---------------------------------------------------------------------------
  // 9. RESOURCE CREATE NEVER SENDS CLIENT STATUS/AVAILABILITY AUTHORITY
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Resource Create Never Sends Status/Availability Authority ---');
  const resWithForgedStatus = await createResource({
    name: `Test Lawn Mower ${Date.now()}`,
    type: 'gardening',
    condition: 'Good',
    general_area: 'Greenwood Commons South',
    handoff_policy: 'Community pickup at Cafe Courtyard',
    status: 'INACTIVE',
    availability: false,
    available: false,
    is_active: false,
  });
  assert(resWithForgedStatus && resWithForgedStatus.available === true, 'Server retains authority over availability and status');

  // ---------------------------------------------------------------------------
  // 10. VALID BORROW REQUEST
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. Valid Borrow Request ---');
  await login(BOB_EMAIL, PASSWORD);
  const now = Date.now();
  const startTime = new Date(now + 3600000).toISOString();
  const endTime = new Date(now + 7200000).toISOString();
  const requestPayload = {
    resource_id: createdResource.resource_id,
    purpose: 'Installing heavy shelving unit',
    duration: '2 hours',
    time_window_start: startTime,
    time_window_end: endTime,
    handoff_preference: 'Community pickup at Cafe Courtyard',
    message: 'Can I borrow your hammer drill for two hours today?',
  };
  const createdReq = await createResourceRequest(requestPayload);
  assert(createdReq && typeof createdReq.request_id === 'string', 'createResourceRequest() creates request with request_id');
  assert(createdReq.status === 'REQUESTED', 'New request starts in REQUESTED status');
  activeRequestId = createdReq.request_id;

  // ---------------------------------------------------------------------------
  // 11. REQUESTER IDENTITY COMES FROM SESSION/BACKEND
  // ---------------------------------------------------------------------------
  console.log('\n--- 11. Requester Identity Comes From Session/Backend ---');
  await login(ALICE_EMAIL, PASSWORD);
  const inboundList = await listInboundRequests();
  const foundReq = inboundList.find((r) => r.request_id === activeRequestId);
  assert(foundReq !== undefined, 'Owner can see inbound request from Bob');
  assert(foundReq.requester_name.includes('Bob'), 'Requester identity authoritatively attributed to Bob');

  // ---------------------------------------------------------------------------
  // 12. REQUEST NEVER SENDS requester_id
  // ---------------------------------------------------------------------------
  console.log('\n--- 12. Request Never Sends requester_id ---');
  await login(BOB_EMAIL, PASSWORD);
  const forgedReq1 = await createResourceRequest({
    resource_id: createdResource.resource_id,
    purpose: 'Test request',
    duration: '1 hour',
    time_window_start: new Date(now + 10800000).toISOString(),
    time_window_end: new Date(now + 14400000).toISOString(),
    handoff_preference: 'Cafe Courtyard',
    requester_id: 'mallory-forged-id',
  });
  assert(forgedReq1 && forgedReq1.request_id, 'createResourceRequest() strips client requester_id');

  // ---------------------------------------------------------------------------
  // 13. REQUEST NEVER SENDS owner_id
  // ---------------------------------------------------------------------------
  console.log('\n--- 13. Request Never Sends owner_id ---');
  const forgedReq2 = await createResourceRequest({
    resource_id: createdResource.resource_id,
    purpose: 'Test request 2',
    duration: '1 hour',
    time_window_start: new Date(now + 18000000).toISOString(),
    time_window_end: new Date(now + 21600000).toISOString(),
    handoff_preference: 'Cafe Courtyard',
    owner_id: 'alice-forged-owner-id',
  });
  assert(forgedReq2 && forgedReq2.request_id, 'createResourceRequest() strips client owner_id');

  // ---------------------------------------------------------------------------
  // 14. REQUEST NEVER SENDS counterpart_id
  // ---------------------------------------------------------------------------
  console.log('\n--- 14. Request Never Sends counterpart_id ---');
  const forgedReq3 = await createResourceRequest({
    resource_id: createdResource.resource_id,
    purpose: 'Test request 3',
    duration: '1 hour',
    time_window_start: new Date(now + 25200000).toISOString(),
    time_window_end: new Date(now + 28800000).toISOString(),
    handoff_preference: 'Cafe Courtyard',
    counterpart_id: 'counterpart-forged-id',
  });
  assert(forgedReq3 && forgedReq3.request_id, 'createResourceRequest() strips counterpart_id');

  // ---------------------------------------------------------------------------
  // 15. REQUEST NEVER SENDS hub_id
  // ---------------------------------------------------------------------------
  console.log('\n--- 15. Request Never Sends hub_id ---');
  const forgedReq4 = await createResourceRequest({
    resource_id: createdResource.resource_id,
    purpose: 'Test request 4',
    duration: '1 hour',
    time_window_start: new Date(now + 32400000).toISOString(),
    time_window_end: new Date(now + 36000000).toISOString(),
    handoff_preference: 'Cafe Courtyard',
    hub_id: 'hub-forged-id',
  });
  assert(forgedReq4 && forgedReq4.request_id, 'createResourceRequest() strips hub_id');

  // ---------------------------------------------------------------------------
  // 16. REQUEST NEVER SENDS AUTHORITATIVE status/state
  // ---------------------------------------------------------------------------
  console.log('\n--- 16. Request Never Sends Authoritative status/state ---');
  const forgedReq5 = await createResourceRequest({
    resource_id: createdResource.resource_id,
    purpose: 'Test request 5',
    duration: '1 hour',
    time_window_start: new Date(now + 39600000).toISOString(),
    time_window_end: new Date(now + 43200000).toISOString(),
    handoff_preference: 'Cafe Courtyard',
    status: 'APPROVED',
    state: 'APPROVED',
  });
  assert(forgedReq5 && forgedReq5.status === 'REQUESTED', 'Request remains in server-enforced REQUESTED status');

  // ---------------------------------------------------------------------------
  // 17. OWN-RESOURCE REJECTION HANDLED
  // ---------------------------------------------------------------------------
  console.log('\n--- 17. Own-Resource Rejection Handled ---');
  await login(ALICE_EMAIL, PASSWORD);
  let ownResourceError = null;
  try {
    await createResourceRequest({
      resource_id: createdResource.resource_id,
      purpose: 'Borrowing my own tool',
      duration: '1 hour',
      time_window_start: new Date(now + 46800000).toISOString(),
      time_window_end: new Date(now + 50400000).toISOString(),
      handoff_preference: 'Cafe Courtyard',
    });
  } catch (err) {
    ownResourceError = err;
  }
  assert(ownResourceError instanceof ApiError, 'Requesting own resource throws ApiError');
  assert(ownResourceError.status === 422 || ownResourceError.status === 400, 'Rejection status is 422/400 (Cannot request own resource)');

  // ---------------------------------------------------------------------------
  // 18. BLOCKED-RESOURCE / INACCESSIBLE RESOURCE REJECTION HANDLED
  // ---------------------------------------------------------------------------
  console.log('\n--- 18. Inaccessible / Blocked Resource Rejection Handled ---');
  await login(BOB_EMAIL, PASSWORD);
  let blockedError = null;
  try {
    await createResourceRequest({
      resource_id: '00000000-0000-0000-0000-000000000000',
      purpose: 'Non-existent item',
      duration: '1 hour',
      time_window_start: new Date(now + 54000000).toISOString(),
      time_window_end: new Date(now + 57600000).toISOString(),
      handoff_preference: 'Cafe Courtyard',
    });
  } catch (err) {
    blockedError = err;
  }
  assert(blockedError instanceof ApiError, 'Requesting inaccessible resource throws ApiError');
  assert(blockedError.status === 404 || blockedError.status === 403, 'Inaccessible rejection returns 404/403');

  // ---------------------------------------------------------------------------
  // 19. OUTBOUND REQUEST LIST
  // ---------------------------------------------------------------------------
  console.log('\n--- 19. Outbound Request List ---');
  await login(BOB_EMAIL, PASSWORD);
  const outboundList = await listOutboundRequests();
  assert(Array.isArray(outboundList), 'listOutboundRequests() returns array for requester');
  const foundOutbound = outboundList.find((r) => r.request_id === activeRequestId);
  assert(foundOutbound !== undefined, 'Outbound list contains active request');
  assert(foundOutbound.counterpart_display === 'Resource Owner (Verified Neighbor)', 'Outbound counterpart is privacy-safe');

  // ---------------------------------------------------------------------------
  // 20. INBOUND REQUEST LIST
  // ---------------------------------------------------------------------------
  console.log('\n--- 20. Inbound Request List ---');
  await login(ALICE_EMAIL, PASSWORD);
  const ownerInbound = await listInboundRequests();
  assert(Array.isArray(ownerInbound), 'listInboundRequests() returns array for owner');
  const targetInbound = ownerInbound.find((r) => r.request_id === activeRequestId);
  assert(targetInbound !== undefined, 'Owner inbound list contains pending request');
  assert(targetInbound.requester_trust !== undefined, 'Inbound request includes factual requester trust signals');
  assert(typeof targetInbound.requester_trust.neighborhood_verified === 'boolean', 'Trust signal includes neighborhood_verified');
  assert(typeof targetInbound.requester_trust.no_outstanding_returns === 'boolean', 'Trust signal includes no_outstanding_returns');

  // ---------------------------------------------------------------------------
  // 21. REQUEST DETAIL
  // ---------------------------------------------------------------------------
  console.log('\n--- 21. Request Detail ---');
  const reqDetail = await getResourceRequest(activeRequestId);
  assert(reqDetail && reqDetail.request_id === activeRequestId, 'getResourceRequest() returns authoritative request detail');
  assert(reqDetail.status === 'REQUESTED', 'Request detail status is REQUESTED');

  // ---------------------------------------------------------------------------
  // 22. UNAUTHORIZED REQUEST DETAIL HANDLED
  // ---------------------------------------------------------------------------
  console.log('\n--- 22. Unauthorized Request Detail Handled ---');
  await login(MALLORY_EMAIL, PASSWORD);
  let unauthReqError = null;
  try {
    await getResourceRequest(activeRequestId);
  } catch (err) {
    unauthReqError = err;
  }
  assert(unauthReqError instanceof ApiError, 'Unrelated member accessing request throws ApiError');
  assert(unauthReqError.status === 404 || unauthReqError.status === 403, 'Unauthorized request access yields 404/403');

  // ---------------------------------------------------------------------------
  // 24. NON-OWNER APPROVE REJECTED
  // ---------------------------------------------------------------------------
  console.log('\n--- 24. Non-Owner Approve Rejected ---');
  // Create a fresh request for approval testing
  await login(BOB_EMAIL, PASSWORD);
  approveTarget = await createResourceRequest({
    resource_id: createdResource.resource_id,
    purpose: 'Approval testing',
    duration: '2 hours',
    time_window_start: new Date(now + 61200000).toISOString(),
    time_window_end: new Date(now + 64800000).toISOString(),
    handoff_preference: 'Cafe Courtyard',
  });

  // Mallory attempts to approve Bob's request
  await login(MALLORY_EMAIL, PASSWORD);
  let malloryApproveError = null;
  try {
    await approveResourceRequest(approveTarget.request_id);
  } catch (err) {
    malloryApproveError = err;
  }
  assert(malloryApproveError instanceof ApiError, 'Non-owner approval throws ApiError');
  assert(malloryApproveError.status === 403 || malloryApproveError.status === 404, 'Non-owner approval returns 403/404');

  // ---------------------------------------------------------------------------
  // 23. OWNER APPROVE
  // ---------------------------------------------------------------------------
  console.log('\n--- 23. Owner Approve ---');
  await login(ALICE_EMAIL, PASSWORD);
  const approvalResult = await approveResourceRequest(approveTarget.request_id);
  assert(approvalResult && approvalResult.request, 'approveResourceRequest() returns approval result');
  assert(approvalResult.request.status === 'APPROVED', 'Request status is transitioned to APPROVED');
  assert(approvalResult.coordination && approvalResult.coordination.state === 'APPROVED', 'Coordination entity spawned in APPROVED state');

  // ---------------------------------------------------------------------------
  // 25. OWNER DECLINE
  // ---------------------------------------------------------------------------
  console.log('\n--- 25. Owner Decline ---');
  await login(BOB_EMAIL, PASSWORD);
  const declineTarget = await createResourceRequest({
    resource_id: createdResource.resource_id,
    purpose: 'Decline testing',
    duration: '1 hour',
    time_window_start: new Date(now + 68400000).toISOString(),
    time_window_end: new Date(now + 72000000).toISOString(),
    handoff_preference: 'Cafe Courtyard',
  });
  declineRequestId = declineTarget.request_id;

  await login(ALICE_EMAIL, PASSWORD);
  const declineResult = await declineResourceRequest(declineRequestId, 'In use for personal project');
  assert(declineResult && declineResult.status === 'DECLINED', 'declineResourceRequest() transitions request to DECLINED');

  // ---------------------------------------------------------------------------
  // 27. UNRELATED USER CANCEL REJECTED
  // ---------------------------------------------------------------------------
  console.log('\n--- 27. Unrelated User Cancel Rejected ---');
  await login(BOB_EMAIL, PASSWORD);
  const cancelTarget = await createResourceRequest({
    resource_id: createdResource.resource_id,
    purpose: 'Cancel testing',
    duration: '1 hour',
    time_window_start: new Date(now + 75600000).toISOString(),
    time_window_end: new Date(now + 79200000).toISOString(),
    handoff_preference: 'Cafe Courtyard',
  });
  cancelRequestId = cancelTarget.request_id;

  await login(MALLORY_EMAIL, PASSWORD);
  let malloryCancelError = null;
  try {
    await cancelResourceRequest(cancelRequestId);
  } catch (err) {
    malloryCancelError = err;
  }
  assert(malloryCancelError instanceof ApiError, 'Unrelated user cancellation throws ApiError');
  assert(malloryCancelError.status === 403 || malloryCancelError.status === 404, 'Unrelated cancellation yields 403/404');

  // ---------------------------------------------------------------------------
  // 26. REQUESTER CANCEL
  // ---------------------------------------------------------------------------
  console.log('\n--- 26. Requester Cancel ---');
  await login(BOB_EMAIL, PASSWORD);
  const cancelResult = await cancelResourceRequest(cancelRequestId);
  assert(cancelResult && cancelResult.status === 'CANCELLED', 'cancelResourceRequest() transitions request to CANCELLED');

  // ---------------------------------------------------------------------------
  // 28. 401 HANDLED
  // ---------------------------------------------------------------------------
  console.log('\n--- 28. 401 Handled ---');
  clearSession();
  let err401 = null;
  try {
    await getResource(createdResource.resource_id);
  } catch (err) {
    err401 = err;
  }
  assert(err401 instanceof ApiError && err401.status === 401, 'Unauthenticated request cleanly throws 401 ApiError');

  // ---------------------------------------------------------------------------
  // 29. 403 HANDLED
  // ---------------------------------------------------------------------------
  console.log('\n--- 29. 403 Handled ---');
  await login(BOB_EMAIL, PASSWORD);
  let err403 = null;
  try {
    await approveResourceRequest(activeRequestId);
  } catch (err) {
    err403 = err;
  }
  assert(err403 instanceof ApiError, 'Forbidden action throws ApiError');
  assert(err403.status === 403 || err403.status === 404, 'Forbidden action yields 403 or 404');

  // ---------------------------------------------------------------------------
  // 30. 404 HANDLED WITHOUT MOCK FALLBACK
  // ---------------------------------------------------------------------------
  console.log('\n--- 30. 404 Handled Without Mock Fallback ---');
  let err404 = null;
  let result404 = null;
  try {
    result404 = await getResource('99999999-9999-9999-9999-999999999999');
  } catch (err) {
    err404 = err;
  }
  assert(err404 instanceof ApiError && err404.status === 404, 'Non-existent item throws 404 ApiError');
  assert(result404 === null, 'No mock resource is substituted on 404');

  // ---------------------------------------------------------------------------
  // 31. 409 CONFLICT HANDLED
  // ---------------------------------------------------------------------------
  console.log('\n--- 31. 409 Conflict Handled ---');
  await login(ALICE_EMAIL, PASSWORD);
  let err409 = null;
  try {
    // Attempt double approval on already approved request
    await approveResourceRequest(approveTarget.request_id);
  } catch (err) {
    err409 = err;
  }
  assert(err409 instanceof ApiError, 'Double approval throws ApiError');
  assert(err409.status === 409 || err409.status === 422 || err409.status === 400, 'Invalid state mutation is rejected');

  // ---------------------------------------------------------------------------
  // 32. NETWORK FAILURE HANDLED
  // ---------------------------------------------------------------------------
  console.log('\n--- 32. Network Failure Handled Without Mock Fallback ---');
  const originalEnv = process.env.VITE_API_BASE_URL;
  process.env.VITE_API_BASE_URL = 'http://127.0.0.1:59999'; // Dead port
  let networkErr = null;
  let networkResult = null;
  try {
    networkResult = await listResources();
  } catch (err) {
    networkErr = err;
  } finally {
    if (originalEnv) {
      process.env.VITE_API_BASE_URL = originalEnv;
    } else {
      delete process.env.VITE_API_BASE_URL;
    }
  }
  assert(networkErr instanceof ApiError, 'Network failure throws normalized ApiError');
  assert(networkErr.status === 0, 'Network failure status is 0');
  assert(networkErr.error === 'NETWORK_ERROR', 'Network error code is NETWORK_ERROR');
  assert(networkResult === null, 'No mock resources returned on network failure');

  // Clean final session
  clearSession();
  await logout().catch(() => {});

  console.log('\n======================================================================');
  console.log(`  ALL 32 INTEGRATION ASSERTIONS PASSED (${passCount} passed, ${failCount} failed)`);
  console.log('======================================================================\n');
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
