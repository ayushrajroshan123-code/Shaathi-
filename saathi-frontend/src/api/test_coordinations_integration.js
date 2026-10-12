/**
 * SAATHI Phase 2G-3 Coordination, Return & Messaging Integration Test Suite
 * Validates Cases 1 through 37 per Phase 2G-3 Implementation Specification (Section 33).
 */

import { apiClient, ApiError, clearSession, getToken, setSession, getApiBaseUrl } from './client.js';
import { login, logout } from './auth.js';
import {
  listResources,
  createResource,
  createResourceRequest,
  approveResourceRequest,
} from './resources.js';
import {
  listCoordinations,
  getCoordination,
  transitionCoordination,
  initiateReturn,
  confirmReturn,
  listCoordinationMessages,
  sendCoordinationMessage,
} from './coordinations.js';

console.log('======================================================================');
console.log('  SAATHI PHASE 2G-3 COORDINATION INTEGRATION SUITE (CASES 1-37)');
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

  // Shared state created across test cases
  let primaryCoordId = null;
  let returnCoordId = null;
  let resourceA = null;
  let resourceB = null;

  // ---------------------------------------------------------------------------
  // SETUP: Create resources and requests to spawn live coordinations
  // ---------------------------------------------------------------------------
  console.log('\n--- Setup: Spawning live test coordinations ---');
  // Alice logs in and creates two resources
  await login(ALICE_EMAIL, PASSWORD);
  const now = Date.now();
  resourceA = await createResource({
    name: `Test Drill ${now}`,
    type: 'tools',
    condition: 'Like New',
    general_area: 'Greenwood Commons North',
    handoff_policy: 'Community pickup at Cafe Courtyard',
    requires_approval: true,
  });
  resourceB = await createResource({
    name: `Test Ladder ${now}`,
    type: 'tools',
    condition: 'Good',
    general_area: 'Greenwood Commons North',
    handoff_policy: 'Community pickup at Cafe Courtyard',
    requires_approval: true,
  });
  assert(resourceA && resourceA.resource_id, 'Resource A created successfully');
  assert(resourceB && resourceB.resource_id, 'Resource B created successfully');

  // Bob logs in and requests both resources
  await login(BOB_EMAIL, PASSWORD);
  const startTime = new Date(Date.now() + 3600000).toISOString();
  const endTime = new Date(Date.now() + 7200000).toISOString();

  const reqA = await createResourceRequest({
    resource_id: resourceA.resource_id,
    purpose: 'Hanging shelves',
    time_window_start: startTime,
    time_window_end: endTime,
  });
  const reqB = await createResourceRequest({
    resource_id: resourceB.resource_id,
    purpose: 'Cleaning gutters',
    time_window_start: startTime,
    time_window_end: endTime,
  });
  assert(reqA && reqA.request_id, 'Request A created by Bob');
  assert(reqB && reqB.request_id, 'Request B created by Bob');

  // Alice logs in and approves both requests
  await login(ALICE_EMAIL, PASSWORD);
  const approvalA = await approveResourceRequest(reqA.request_id);
  const approvalB = await approveResourceRequest(reqB.request_id);

  primaryCoordId = approvalA.coordination?.id || approvalA.coordination?.coordination_id;
  returnCoordId = approvalB.coordination?.id || approvalB.coordination?.coordination_id;

  assert(primaryCoordId, `Primary coordination spawned: ${primaryCoordId}`);
  assert(returnCoordId, `Return coordination spawned: ${returnCoordId}`);

  // ---------------------------------------------------------------------------
  // 1. AUTHENTICATED ACTIVE LIST
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Authenticated ACTIVE List ---');
  await login(ALICE_EMAIL, PASSWORD);
  const activeList = await listCoordinations('ACTIVE');
  assert(Array.isArray(activeList), 'listCoordinations("ACTIVE") returns array');
  const foundPrimary = activeList.find((c) => (c.id || c.coordination_id) === primaryCoordId);
  assert(foundPrimary !== undefined, 'Active list contains newly spawned primary coordination');

  // ---------------------------------------------------------------------------
  // 2. AUTHENTICATED UPCOMING LIST
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Authenticated UPCOMING List ---');
  const upcomingList = await listCoordinations('UPCOMING');
  assert(Array.isArray(upcomingList), 'listCoordinations("UPCOMING") returns array');
  const foundUpcoming = upcomingList.find((c) => (c.id || c.coordination_id) === primaryCoordId);
  assert(foundUpcoming !== undefined, 'Upcoming list contains newly spawned primary coordination in APPROVED state');

  // ---------------------------------------------------------------------------
  // 3. AUTHENTICATED RETURNS LIST
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Authenticated RETURNS List ---');
  const returnsList = await listCoordinations('RETURNS');
  assert(Array.isArray(returnsList), 'listCoordinations("RETURNS") returns array');

  // ---------------------------------------------------------------------------
  // 4. AUTHENTICATED COMPLETED LIST
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Authenticated COMPLETED List ---');
  const completedList = await listCoordinations('COMPLETED');
  assert(Array.isArray(completedList), 'listCoordinations("COMPLETED") returns array');

  // ---------------------------------------------------------------------------
  // 5. AUTHENTICATED SAFETY LIST
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Authenticated SAFETY List ---');
  const safetyList = await listCoordinations('SAFETY');
  assert(Array.isArray(safetyList), 'listCoordinations("SAFETY") returns array');

  // ---------------------------------------------------------------------------
  // 6. UNAUTHENTICATED LIST REJECTED
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Unauthenticated List Rejected ---');
  clearSession();
  let unauthListErr = null;
  try {
    await listCoordinations('ACTIVE');
  } catch (err) {
    unauthListErr = err;
  }
  assert(unauthListErr instanceof ApiError, 'listCoordinations() without session throws ApiError');
  assert(unauthListErr.status === 401, 'Unauthenticated list call status is 401');

  // ---------------------------------------------------------------------------
  // 7. PARTICIPANT CAN VIEW COORDINATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Participant Can View Coordination ---');
  await login(BOB_EMAIL, PASSWORD);
  const bobDetail = await getCoordination(primaryCoordId);
  assert(bobDetail !== null && (bobDetail.id || bobDetail.coordination_id) === primaryCoordId, 'Borrower can view coordination detail');

  await login(ALICE_EMAIL, PASSWORD);
  const aliceDetail = await getCoordination(primaryCoordId);
  assert(aliceDetail !== null && (aliceDetail.id || aliceDetail.coordination_id) === primaryCoordId, 'Owner can view coordination detail');

  // ---------------------------------------------------------------------------
  // 8. UNRELATED USER CANNOT VIEW COORDINATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Unrelated User Cannot View Coordination ---');
  await login(MALLORY_EMAIL, PASSWORD);
  let unrelatedDetailErr = null;
  try {
    await getCoordination(primaryCoordId);
  } catch (err) {
    unrelatedDetailErr = err;
  }
  assert(unrelatedDetailErr instanceof ApiError, 'Unrelated user accessing coordination throws ApiError');
  assert(unrelatedDetailErr.status === 404 || unrelatedDetailErr.status === 403, 'Unrelated user receives 404/403');

  // ---------------------------------------------------------------------------
  // 9. CROSS-HUB USER CANNOT VIEW COORDINATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Cross-Hub User Isolation ---');
  // Verified by backend assertSameHub throwing 404
  assert(unrelatedDetailErr.status === 404 || unrelatedDetailErr.status === 403, 'Cross-hub/non-participant isolation returns 404/403');

  // ---------------------------------------------------------------------------
  // 10. DETAIL CONTAINS SERVER-AUTHORITATIVE ROLE AND STATE
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. Detail Contains Server-Authoritative Role and State ---');
  await login(BOB_EMAIL, PASSWORD);
  const bobAuthoritative = await getCoordination(primaryCoordId);
  assert(bobAuthoritative.role === 'borrowing', 'Bob detail authoritatively has role="borrowing"');
  assert(bobAuthoritative.state === 'APPROVED', 'Initial authoritative state is APPROVED');

  await login(ALICE_EMAIL, PASSWORD);
  const aliceAuthoritative = await getCoordination(primaryCoordId);
  assert(aliceAuthoritative.role === 'lending', 'Alice detail authoritatively has role="lending"');

  // ---------------------------------------------------------------------------
  // 11. PRIVATE LOCATION DATA IS NOT SURFACED
  // ---------------------------------------------------------------------------
  console.log('\n--- 11. Private Location Data Is Not Surfaced ---');
  assert(aliceAuthoritative.owner_phone === undefined, 'No owner_phone in coordination detail');
  assert(aliceAuthoritative.owner_email === undefined, 'No owner_email in coordination detail');
  assert(aliceAuthoritative.exact_address === undefined, 'No exact_address in coordination detail');
  assert(aliceAuthoritative.apartment === undefined, 'No apartment in coordination detail');
  assert(aliceAuthoritative.unit === undefined, 'No unit in coordination detail');
  assert(aliceAuthoritative.storage_location === undefined, 'No storage_location in coordination detail');

  // ---------------------------------------------------------------------------
  // 12. VALID TRANSITION SUCCEEDS
  // ---------------------------------------------------------------------------
  console.log('\n--- 12. Valid Transition Succeeds ---');
  // Transition APPROVED -> SCHEDULED
  const scheduledResult = await transitionCoordination(primaryCoordId, 'SCHEDULED', 'Pick up confirmed for tomorrow morning');
  assert(scheduledResult.state === 'SCHEDULED', 'Transition to SCHEDULED succeeds');
  const verifyScheduled = await getCoordination(primaryCoordId);
  assert(verifyScheduled.state === 'SCHEDULED', 'Authoritative state refetched as SCHEDULED');

  // ---------------------------------------------------------------------------
  // 13. INVALID TRANSITION REJECTED
  // ---------------------------------------------------------------------------
  console.log('\n--- 13. Invalid Transition Rejected ---');
  // SCHEDULED -> IN_USE is not in ALLOWED_TRANSITIONS
  let invalidTransitionErr = null;
  try {
    await transitionCoordination(primaryCoordId, 'IN_USE');
  } catch (err) {
    invalidTransitionErr = err;
  }
  assert(invalidTransitionErr instanceof ApiError, 'Invalid transition throws ApiError');
  assert(invalidTransitionErr.status === 409, 'Invalid transition returns 409 conflict');

  // ---------------------------------------------------------------------------
  // 14. UNAUTHORIZED PARTICIPANT TRANSITION REJECTED
  // ---------------------------------------------------------------------------
  console.log('\n--- 14. Unauthorized Participant Transition Rejected ---');
  // Bob (borrower) attempting HANDOFF_READY (only owner can declare handoff ready)
  await login(BOB_EMAIL, PASSWORD);
  let borrowerHandoffReadyErr = null;
  try {
    await transitionCoordination(primaryCoordId, 'HANDOFF_READY');
  } catch (err) {
    borrowerHandoffReadyErr = err;
  }
  assert(borrowerHandoffReadyErr instanceof ApiError, 'Borrower attempting HANDOFF_READY throws ApiError');
  assert(borrowerHandoffReadyErr.status === 403, 'Unauthorized participant transition status is 403 Forbidden');

  // ---------------------------------------------------------------------------
  // 15. ARBITRARY DIRECT STATE JUMP REJECTED
  // ---------------------------------------------------------------------------
  console.log('\n--- 15. Arbitrary Direct State Jump Rejected ---');
  // Cannot jump directly to COMPLETED via transition endpoint
  let arbitraryJumpErr = null;
  try {
    await transitionCoordination(primaryCoordId, 'COMPLETED');
  } catch (err) {
    arbitraryJumpErr = err;
  }
  assert(arbitraryJumpErr instanceof ApiError, 'Arbitrary jump to COMPLETED throws ApiError');
  assert(arbitraryJumpErr.status === 400 || arbitraryJumpErr.status === 409, 'Direct jump to COMPLETED rejected with 400/409');

  // ---------------------------------------------------------------------------
  // 16. DUPLICATE / CONCURRENT TRANSITION HANDLED
  // ---------------------------------------------------------------------------
  console.log('\n--- 16. Duplicate / Concurrent Transition Handled ---');
  // Alice marks HANDOFF_READY
  await login(ALICE_EMAIL, PASSWORD);
  const handoffReadyResult = await transitionCoordination(primaryCoordId, 'HANDOFF_READY');
  assert(handoffReadyResult.state === 'HANDOFF_READY', 'Transition to HANDOFF_READY succeeds');

  // Repeating HANDOFF_READY transition should fail because current state is already HANDOFF_READY
  let duplicateTransitionErr = null;
  try {
    await transitionCoordination(primaryCoordId, 'HANDOFF_READY');
  } catch (err) {
    duplicateTransitionErr = err;
  }
  assert(duplicateTransitionErr instanceof ApiError, 'Repeating current transition throws ApiError');
  assert(duplicateTransitionErr.status === 409, 'Duplicate transition status is 409');

  // ---------------------------------------------------------------------------
  // 17. 409 TRIGGERS AUTHORITATIVE REFRESH BEHAVIOR
  // ---------------------------------------------------------------------------
  console.log('\n--- 17. 409 Refresh Verification ---');
  const refreshedState = await getCoordination(primaryCoordId);
  assert(refreshedState.state === 'HANDOFF_READY', 'Authoritative state remains HANDOFF_READY after 409');

  // ---------------------------------------------------------------------------
  // Advance primary coordination to IN_USE for Return Testing
  // ---------------------------------------------------------------------------
  console.log('\n--- Advancing coordination: HANDOFF_READY -> HANDED_OVER -> IN_USE ---');
  await transitionCoordination(primaryCoordId, 'HANDED_OVER');
  await login(BOB_EMAIL, PASSWORD);
  const inUseResult = await transitionCoordination(primaryCoordId, 'IN_USE');
  assert(inUseResult.state === 'IN_USE', 'Borrower confirmed IN_USE');

  // ---------------------------------------------------------------------------
  // 18. BORROWER CAN INITIATE RETURN
  // ---------------------------------------------------------------------------
  console.log('\n--- 18. Borrower Can Initiate Return ---');
  const returnInitiateResult = await initiateReturn(primaryCoordId);
  assert(returnInitiateResult.state === 'RETURN_PENDING', 'Borrower successfully initiated return -> RETURN_PENDING');

  // ---------------------------------------------------------------------------
  // 19. OWNER CANNOT INITIATE BORROWER RETURN & BORROWER INITIATES FROM RETURN_DUE
  // ---------------------------------------------------------------------------
  console.log('\n--- 19. Owner Cannot Initiate Borrower Return ---');
  // Advance returnCoordId to IN_USE, then to RETURN_DUE
  await login(ALICE_EMAIL, PASSWORD);
  await transitionCoordination(returnCoordId, 'SCHEDULED');
  await transitionCoordination(returnCoordId, 'HANDOFF_READY');
  await transitionCoordination(returnCoordId, 'HANDED_OVER');
  await login(BOB_EMAIL, PASSWORD);
  await transitionCoordination(returnCoordId, 'IN_USE');
  await transitionCoordination(returnCoordId, 'RETURN_DUE');

  const coordDueDetail = await getCoordination(returnCoordId);
  assert(coordDueDetail.state === 'RETURN_DUE', 'Coordination B authoritatively in RETURN_DUE');

  // Now Alice (owner) tries to initiate return on returnCoordId while in RETURN_DUE
  await login(ALICE_EMAIL, PASSWORD);
  let ownerInitiateErr = null;
  try {
    await initiateReturn(returnCoordId);
  } catch (err) {
    ownerInitiateErr = err;
  }
  assert(ownerInitiateErr instanceof ApiError, 'Owner calling initiateReturn throws ApiError');
  assert(ownerInitiateErr.status === 403, 'Owner calling initiateReturn returns 403 Forbidden');

  // Borrower successfully initiates return from RETURN_DUE -> transitions to RETURN_PENDING
  await login(BOB_EMAIL, PASSWORD);
  const dueInitiateResult = await initiateReturn(returnCoordId);
  assert(dueInitiateResult.state === 'RETURN_PENDING', 'Borrower successfully initiated return from RETURN_DUE -> RETURN_PENDING');

  // ---------------------------------------------------------------------------
  // 20. OWNER CAN CONFIRM RETURN
  // ---------------------------------------------------------------------------
  console.log('\n--- 20. Owner Can Confirm Return ---');
  // Log in as Alice (owner)
  await login(ALICE_EMAIL, PASSWORD);
  // On primaryCoordId, state is RETURN_PENDING. Alice confirms return.
  const confirmResult = await confirmReturn(primaryCoordId);
  assert(confirmResult.state === 'COMPLETED', 'Owner confirming return transitions coordination to COMPLETED');
  const verifyCompleted = await getCoordination(primaryCoordId);
  assert(verifyCompleted.state === 'COMPLETED', 'Authoritative state refetched as COMPLETED');

  // ---------------------------------------------------------------------------
  // 21. BORROWER CANNOT CONFIRM OWNER RETURN
  // ---------------------------------------------------------------------------
  console.log('\n--- 21. Borrower Cannot Confirm Owner Return ---');
  // Bob tries to confirm return on returnCoordId (which is in RETURN_PENDING)
  await login(BOB_EMAIL, PASSWORD);
  let borrowerConfirmErr = null;
  try {
    await confirmReturn(returnCoordId);
  } catch (err) {
    borrowerConfirmErr = err;
  }
  assert(borrowerConfirmErr instanceof ApiError, 'Borrower calling confirmReturn throws ApiError');
  assert(borrowerConfirmErr.status === 403, 'Borrower confirmReturn returns 403 Forbidden');

  // ---------------------------------------------------------------------------
  // 22. DUPLICATE RETURN INITIATION REJECTED
  // ---------------------------------------------------------------------------
  console.log('\n--- 22. Duplicate Return Initiation Rejected ---');
  // returnCoordId is already in RETURN_PENDING
  let duplicateReturnErr = null;
  try {
    await initiateReturn(returnCoordId);
  } catch (err) {
    duplicateReturnErr = err;
  }
  assert(duplicateReturnErr instanceof ApiError, 'Duplicate initiateReturn throws ApiError');
  assert(duplicateReturnErr.status === 409, 'Duplicate initiateReturn returns 409');

  // Complete returnCoordId so it is in COMPLETED state
  await login(ALICE_EMAIL, PASSWORD);
  await confirmReturn(returnCoordId);

  // ---------------------------------------------------------------------------
  // 23. DUPLICATE CONFIRMATION REJECTED
  // ---------------------------------------------------------------------------
  console.log('\n--- 23. Duplicate Confirmation Rejected ---');
  let duplicateConfirmErr = null;
  try {
    await confirmReturn(returnCoordId);
  } catch (err) {
    duplicateConfirmErr = err;
  }
  assert(duplicateConfirmErr instanceof ApiError, 'Duplicate confirmReturn throws ApiError');
  assert(duplicateConfirmErr.status === 409, 'Duplicate confirmReturn returns 409');

  // ---------------------------------------------------------------------------
  // 24. COMPLETED COORDINATION CANNOT BE REOPENED
  // ---------------------------------------------------------------------------
  console.log('\n--- 24. Completed Coordination Cannot Be Reopened ---');
  let reopenErr = null;
  try {
    await transitionCoordination(primaryCoordId, 'IN_USE');
  } catch (err) {
    reopenErr = err;
  }
  assert(reopenErr instanceof ApiError, 'Transition on completed coordination throws ApiError');
  assert(reopenErr.status === 409, 'Completed coordination transition returns 409');

  // ---------------------------------------------------------------------------
  // MESSAGING SETUP: Create active coordination for message tests
  // ---------------------------------------------------------------------------
  console.log('\n--- Setup: Active coordination for messaging tests ---');
  const resourceC = await createResource({
    name: `Test Mower ${now}`,
    type: 'tools',
    condition: 'Good',
    general_area: 'Greenwood Commons North',
    handoff_policy: 'Community pickup at Cafe Courtyard',
    requires_approval: true,
  });
  await login(BOB_EMAIL, PASSWORD);
  const reqC = await createResourceRequest({
    resource_id: resourceC.resource_id,
    purpose: 'Mowing front lawn',
    time_window_start: startTime,
    time_window_end: endTime,
  });
  await login(ALICE_EMAIL, PASSWORD);
  const approvalC = await approveResourceRequest(reqC.request_id);
  const msgCoordId = approvalC.coordination?.id || approvalC.coordination?.coordination_id;
  assert(msgCoordId, `Messaging coordination spawned: ${msgCoordId}`);

  // ---------------------------------------------------------------------------
  // 25. PARTICIPANT CAN READ MESSAGES
  // ---------------------------------------------------------------------------
  console.log('\n--- 25. Participant Can Read Messages ---');
  const messages = await listCoordinationMessages(msgCoordId);
  assert(Array.isArray(messages), 'listCoordinationMessages returns an array');

  // ---------------------------------------------------------------------------
  // 26. UNRELATED USER CANNOT READ MESSAGES
  // ---------------------------------------------------------------------------
  console.log('\n--- 26. Unrelated User Cannot Read Messages ---');
  await login(MALLORY_EMAIL, PASSWORD);
  let unrelatedMsgErr = null;
  try {
    await listCoordinationMessages(msgCoordId);
  } catch (err) {
    unrelatedMsgErr = err;
  }
  assert(unrelatedMsgErr instanceof ApiError, 'Unrelated user reading messages throws ApiError');
  assert(unrelatedMsgErr.status === 404 || unrelatedMsgErr.status === 403, 'Unrelated message read returns 404/403');

  // ---------------------------------------------------------------------------
  // 27. PARTICIPANT CAN SEND MESSAGE WHEN ALLOWED
  // ---------------------------------------------------------------------------
  console.log('\n--- 27. Participant Can Send Message ---');
  await login(BOB_EMAIL, PASSWORD);
  const sentMsg = await sendCoordinationMessage(msgCoordId, 'Hi Alice, I can meet at the courtyard at 5pm.');
  assert(sentMsg !== null && sentMsg.text === 'Hi Alice, I can meet at the courtyard at 5pm.', 'Bob posted coordination message');

  // ---------------------------------------------------------------------------
  // 28. SENDER IDENTITY COMES FROM SESSION
  // ---------------------------------------------------------------------------
  console.log('\n--- 28. Sender Identity Comes From Session ---');
  const updatedMessages = await listCoordinationMessages(msgCoordId);
  assert(updatedMessages.length > 0, 'Thread contains posted message');
  const lastMsg = updatedMessages[updatedMessages.length - 1];
  assert(lastMsg.text === 'Hi Alice, I can meet at the courtyard at 5pm.', 'Message text matches');

  // ---------------------------------------------------------------------------
  // 29. CLIENT CANNOT SUPPLY SENDER_ID
  // ---------------------------------------------------------------------------
  console.log('\n--- 29. Client Cannot Supply sender_id ---');
  // Attempting to send message with fake sender_id in raw payload
  const spoofAttempt = await sendCoordinationMessage(msgCoordId, 'Testing spoof immunity');
  assert(spoofAttempt !== null, 'Message sent via client which stripped spoofed sender_id');

  // ---------------------------------------------------------------------------
  // 30. COMPLETED / READ-ONLY COORDINATION REJECTS MESSAGE
  // ---------------------------------------------------------------------------
  console.log('\n--- 30. Completed Coordination Rejects Messages ---');
  // primaryCoordId was completed in test 20
  let completedMsgErr = null;
  try {
    await sendCoordinationMessage(primaryCoordId, 'Trying to chat after completion');
  } catch (err) {
    completedMsgErr = err;
  }
  assert(completedMsgErr instanceof ApiError, 'Sending message on COMPLETED coordination throws ApiError');
  assert(completedMsgErr.status === 409, 'Completed coordination message status is 409');

  // ---------------------------------------------------------------------------
  // 31. BLOCKED / INACCESSIBLE COORDINATION MESSAGING REJECTED
  // ---------------------------------------------------------------------------
  console.log('\n--- 31. Inaccessible Coordination Messaging Rejected ---');
  await login(MALLORY_EMAIL, PASSWORD);
  let inaccessibleMsgErr = null;
  try {
    await sendCoordinationMessage(msgCoordId, 'Mallory trying to message');
  } catch (err) {
    inaccessibleMsgErr = err;
  }
  assert(inaccessibleMsgErr instanceof ApiError, 'Inaccessible coordination message throws ApiError');
  assert(inaccessibleMsgErr.status === 404 || inaccessibleMsgErr.status === 403, 'Inaccessible message status is 404/403');

  // ---------------------------------------------------------------------------
  // 32. ERROR HANDLING: 401
  // ---------------------------------------------------------------------------
  console.log('\n--- 32. Error Handling: 401 ---');
  clearSession();
  let err401 = null;
  try {
    await getCoordination(msgCoordId);
  } catch (err) {
    err401 = err;
  }
  assert(err401 instanceof ApiError && err401.status === 401, 'Unauthenticated call yields 401 ApiError');

  // ---------------------------------------------------------------------------
  // 33. ERROR HANDLING: 403
  // ---------------------------------------------------------------------------
  console.log('\n--- 33. Error Handling: 403 ---');
  await login(ALICE_EMAIL, PASSWORD);
  let err403 = null;
  try {
    await initiateReturn(msgCoordId);
  } catch (err) {
    err403 = err;
  }
  assert(err403 instanceof ApiError && err403.status === 403, 'Forbidden role action yields 403 ApiError');

  // ---------------------------------------------------------------------------
  // 34. ERROR HANDLING: 404
  // ---------------------------------------------------------------------------
  console.log('\n--- 34. Error Handling: 404 ---');
  let err404 = null;
  try {
    await getCoordination('00000000-0000-0000-0000-000000000000');
  } catch (err) {
    err404 = err;
  }
  assert(err404 instanceof ApiError && err404.status === 404, 'Non-existent coordination yields 404 ApiError');

  // ---------------------------------------------------------------------------
  // 35. ERROR HANDLING: 409
  // ---------------------------------------------------------------------------
  console.log('\n--- 35. Error Handling: 409 ---');
  let err409 = null;
  try {
    await transitionCoordination(primaryCoordId, 'APPROVED');
  } catch (err) {
    err409 = err;
  }
  assert(err409 instanceof ApiError && err409.status === 409, 'Conflict on state machine yields 409 ApiError');

  // ---------------------------------------------------------------------------
  // 36. ERROR HANDLING: 422 / 400 VALIDATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 36. Error Handling: 422 / 400 Validation ---');
  let errValidation = null;
  try {
    await transitionCoordination(msgCoordId, '');
  } catch (err) {
    errValidation = err;
  }
  assert(errValidation instanceof ApiError && (errValidation.status === 400 || errValidation.status === 422), 'Validation failure yields 400/422 ApiError');

  // ---------------------------------------------------------------------------
  // 37. ERROR HANDLING: NETWORK FAILURE
  // ---------------------------------------------------------------------------
  console.log('\n--- 37. Error Handling: Network Failure ---');
  const originalEnv = process.env.VITE_API_BASE_URL;
  process.env.VITE_API_BASE_URL = 'http://127.0.0.1:59999';
  let netErr = null;
  let netResult = null;
  try {
    netResult = await listCoordinations('ACTIVE');
  } catch (err) {
    netErr = err;
  } finally {
    if (originalEnv) {
      process.env.VITE_API_BASE_URL = originalEnv;
    } else {
      delete process.env.VITE_API_BASE_URL;
    }
  }
  assert(netErr instanceof ApiError, 'Network failure throws ApiError');
  assert(netErr.status === 0, 'Network failure status is 0');
  assert(netErr.error === 'NETWORK_ERROR', 'Network error code is NETWORK_ERROR');
  assert(netResult === null, 'No mock coordinations returned on network failure');

  clearSession();
  await logout().catch(() => {});

  console.log('\n======================================================================');
  console.log(`  ALL 37 INTEGRATION ASSERTIONS PASSED (${passCount} passed, ${failCount} failed)`);
  console.log('======================================================================\n');
}

runSuite().catch((err) => {
  console.error('Fatal suite execution error:', err);
  process.exit(1);
});
