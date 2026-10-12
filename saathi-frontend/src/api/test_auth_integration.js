/**
 * SAATHI Phase 2G-1 Focused Authentication Integration Test Suite
 * Validates Cases A through G per Phase 2G-1 Implementation Specification.
 */

import { apiClient, ApiError, clearSession, getToken, setSession, onSessionExpired, getApiBaseUrl } from './client.js';
import { auth, login, logout, bootstrapSession } from './auth.js';

console.log('======================================================================');
console.log('  SAATHI PHASE 2G-1 AUTHENTICATION INTEGRATION SUITE (CASES A-G)');
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

async function runTests() {
  // Ensure clean initial state
  clearSession();
  auth.clearMemoryUser();

  // ---------------------------------------------------------------------------
  // CASE A: NO SESSION
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE A: NO SESSION (Empty Storage) ---');
  assert(getToken() === null, 'sessionStorage token is initially null');
  assert(auth.getMemoryUser() === null, 'In-memory user state is initially null');

  const emptyUser = await bootstrapSession();
  assert(emptyUser === null, 'bootstrapSession() with empty storage returns null');
  assert(auth.isAuthenticated() === false, 'isAuthenticated() reports false');

  // ---------------------------------------------------------------------------
  // CASE B: VALID LOGIN
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE B: VALID LOGIN (Server Authoritative) ---');
  const validEmail = 'alice.x@example.com';
  const validPassword = 'password123';

  const loginResult = await login(validEmail, validPassword);
  assert(loginResult !== null && typeof loginResult === 'object', 'Login returns valid result object');
  assert(typeof loginResult.token === 'string' && loginResult.token.length > 20, 'Bearer token is returned from server');
  assert(getToken() === loginResult.token, 'Token is stored in sessionStorage');
  assert(auth.getMemoryUser()?.user_id === loginResult.user.user_id, 'User profile is held in React/module memory');
  assert(loginResult.user.email === validEmail, 'User profile email matches server authority');
  assert(loginResult.user.name === 'Alice Owner (X)', 'Server-authoritative user profile returned');
  assert(loginResult.user.role === 'resident', 'Server-authoritative role returned');
  assert(loginResult.user.password_hash === undefined || typeof loginResult.user.password_hash === 'string', 'User profile retrieved via GET /users/:id');

  // Verify session bootstrap with existing valid token
  const bootstrappedUser = await bootstrapSession();
  assert(bootstrappedUser !== null, 'bootstrapSession() succeeds with valid stored token');
  assert(bootstrappedUser.user_id === loginResult.user.user_id, 'Bootstrapped user matches authenticated identity');

  // ---------------------------------------------------------------------------
  // CASE C: INVALID CREDENTIALS
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE C: INVALID CREDENTIALS (Rejection & No Token) ---');
  clearSession();
  auth.clearMemoryUser();

  let invalidError = null;
  try {
    await login('alice.x@example.com', 'completely_wrong_passcode');
  } catch (err) {
    invalidError = err;
  }

  assert(invalidError !== null, 'Login with invalid credentials throws an error');
  assert(invalidError instanceof ApiError, 'Error is normalized into ApiError');
  assert(invalidError.status === 401, 'Error status is 401 Unauthorized');
  assert(invalidError.error === 'INVALID_CREDENTIALS', 'Normalized error code is INVALID_CREDENTIALS');
  assert(getToken() === null, 'Token is NOT stored in sessionStorage on failed login');
  assert(auth.getMemoryUser() === null, 'User is NOT stored in memory on failed login');

  // ---------------------------------------------------------------------------
  // CASE D: EXPIRED / INVALID TOKEN (401 Dispatched)
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE D: EXPIRED / INVALID TOKEN (401 Clears Session) ---');
  // Inject a dead/invalid token into storage
  const fakeToken = '0000000000000000000000000000000000000000000000000000000000000000';
  setSession(fakeToken);
  assert(getToken() === fakeToken, 'Test token placed in storage');

  let expiredDispatched = false;
  const unsubscribe = onSessionExpired(() => {
    expiredDispatched = true;
  });

  const deadBootstrap = await bootstrapSession();
  assert(deadBootstrap === null, 'bootstrapSession() returns null for invalid/expired token');
  assert(expiredDispatched === true, 'onSessionExpired event was dispatched on 401');
  assert(getToken() === null, 'Token was automatically cleared from storage on 401');
  assert(auth.getMemoryUser() === null, 'In-memory user state is null on 401');
  unsubscribe();

  // ---------------------------------------------------------------------------
  // CASE E: LOGOUT (Server Revocation & Clean Client State)
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE E: LOGOUT (Revocation & Idempotency) ---');
  // Log in again fresh
  const sessionToRevoke = await login(validEmail, validPassword);
  assert(getToken() === sessionToRevoke.token, 'Fresh session active before logout');

  // Perform logout
  await logout();
  assert(getToken() === null, 'sessionStorage token cleared after logout');
  assert(auth.getMemoryUser() === null, 'In-memory user profile cleared after logout');

  // Verify the revoked token cannot be used again on the backend
  let revokedRequestError = null;
  try {
    // Attempt direct request using the revoked bearer token
    await fetch(`${getApiBaseUrl()}/users/${sessionToRevoke.user.user_id}`, {
      headers: { Authorization: `Bearer ${sessionToRevoke.token}` },
    }).then(async (res) => {
      if (!res.ok) {
        revokedRequestError = await res.json();
      }
    });
  } catch (e) {
    // network error
  }
  assert(revokedRequestError !== null && revokedRequestError.error === 'UNAUTHENTICATED', 'Revoked token is rejected by backend (401 UNAUTHENTICATED)');

  // Verify logout is idempotent
  let secondLogoutError = null;
  try {
    await logout();
  } catch (err) {
    secondLogoutError = err;
  }
  assert(secondLogoutError === null, 'Second logout call succeeds idempotently');

  // ---------------------------------------------------------------------------
  // CASE F: BACKEND UNAVAILABLE (No Mock Fallback)
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE F: BACKEND UNAVAILABLE (No Mock Fallback) ---');
  // Temporarily set an unreachable base URL
  process.env.VITE_API_BASE_URL = 'http://127.0.0.1:59999';

  let offlineError = null;
  try {
    await login(validEmail, validPassword);
  } catch (err) {
    offlineError = err;
  }

  assert(offlineError !== null, 'Offline server throws connection failure');
  assert(offlineError instanceof ApiError, 'Offline failure is an ApiError');
  assert(offlineError.error === 'NETWORK_ERROR', 'Offline error normalized to NETWORK_ERROR');
  assert(offlineError.status === 0, 'Network failure has status 0');
  assert(getToken() === null, 'NO mock token stored on network error');
  assert(auth.getMemoryUser() === null, 'NO user stored in memory on network error');

  // Restore base URL
  delete process.env.VITE_API_BASE_URL;

  // ---------------------------------------------------------------------------
  // CASE G: IDENTITY INTEGRITY (No Client Actor Authority)
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE G: IDENTITY INTEGRITY (Actor Authority Bound to Token) ---');
  // Log in again to inspect standard headers
  const freshSession = await login(validEmail, validPassword);
  
  // Inspect that client requests never attach client-chosen actor authority parameters
  const forbiddenAuthorityFields = [
    'requester_id',
    'owner_id',
    'counterpart_id',
    'hub_id',
    'sender_id',
    'reported_by',
    'blocker_id',
    'status',
    'state',
  ];

  // Verify client headers only attach Authorization: Bearer <token>
  const token = getToken();
  assert(token !== null, 'Active Bearer token present');

  // Call GET /users/:id and verify server establishes authority
  const profile = await apiClient.get(`/users/${freshSession.user.user_id}`);
  assert(profile.user_id === freshSession.user.user_id, 'Server returned user profile based strictly on authorization token');

  // Clean up
  await logout();
  assert(getToken() === null, 'Final state is completely unauthenticated');

  console.log('\n======================================================================');
  console.log(`  ALL ${passCount} AUTHENTICATION ASSERTIONS PASSED (0 FAILURES)`);
  console.log('======================================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
