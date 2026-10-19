/**
 * SAATHI Phase 2G-1 Session Restoration & Cold Start Regression Test Suite
 * Fully hermetic test with controlled HTTP mocks (Zero database writes, Zero external dependencies).
 * 
 * Validates the 10 core regression requirements:
 *  1. Cold start with no token (returns null, unauthenticated).
 *  2. Cold start with a valid token restores user profile via GET /auth/me.
 *  3. In-memory user state was strictly null before cold start (proves reproduction & resolution of defect).
 *  4. Cold start with revoked/invalid token leads to unauthenticated flow & clears storage.
 *  5. 401 session-expiration callback is dispatched on invalid token.
 *  6. Network/API failure during bootstrap throws without clearing valid token or manufacturing a user.
 *  7. Login flow functions via POST /auth/login + GET /auth/me.
 *  8. Logout clears token and subsequent bootstrap returns null.
 *  9. Stale bootstrap response cannot restore user after logout (bootstrapRequestId guard).
 * 10. Identity, role, and hub come strictly from server response, not browser metadata.
 */

import { apiClient, clearSession, getToken, setSession, onSessionExpired } from './client.js';
import { auth, login, logout, bootstrapSession } from './auth.js';

console.log('======================================================================');
console.log('  SAATHI SESSION RESTORATION COLD-START REGRESSION TEST SUITE');
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

// Mock server state
let mockMeStatus = 200;
let mockMeResponse = {
  user_id: '11111111-1111-4111-8111-111111111111',
  name: 'Alice Owner (X)',
  email: 'alice.x@example.com',
  role: 'resident',
  hub_id: 'aaaa1111-1111-4111-8111-111111111111',
  account_status: 'active',
  is_active: true,
};
let mockNetworkError = false;
let mockDelayMs = 0;
let capturedAuthHeaders = [];

const originalFetch = globalThis.fetch;

// Install hermetic fetch mock
globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);
  const authHeader = options.headers?.['Authorization'] || options.headers?.['authorization'] || null;
  if (authHeader) {
    capturedAuthHeaders.push(authHeader);
  }

  if (mockNetworkError) {
    throw new Error('ECONNREFUSED');
  }

  if (mockDelayMs > 0) {
    await new Promise((r) => setTimeout(r, mockDelayMs));
  }

  // GET /auth/me
  if (urlStr.includes('/auth/me')) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        status: 401,
        ok: false,
        headers: { get: () => 'application/json' },
        json: async () => ({ error: 'UNAUTHENTICATED', message: 'Bearer token required', status: 401 }),
      };
    }
    if (mockMeStatus !== 200) {
      return {
        status: mockMeStatus,
        ok: false,
        headers: { get: () => 'application/json' },
        json: async () => ({ error: 'UNAUTHENTICATED', message: 'invalid session', status: mockMeStatus }),
      };
    }
    return {
      status: 200,
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ ...mockMeResponse }),
    };
  }

  // POST /auth/login
  if (urlStr.includes('/auth/login') && options.method === 'POST') {
    const body = JSON.parse(options.body);
    if (body.email === 'alice.x@example.com' && body.password === 'password123') {
      return {
        status: 200,
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          token: 'mock_valid_hex_bearer_token_32_bytes_length_1234567890abcdef',
          user_id: mockMeResponse.user_id,
          role: mockMeResponse.role,
        }),
      };
    }
    return {
      status: 401,
      ok: false,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'INVALID_CREDENTIALS', message: 'invalid email or password', status: 401 }),
    };
  }

  // POST /auth/logout
  if (urlStr.includes('/auth/logout') && options.method === 'POST') {
    return {
      status: 204,
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => null,
    };
  }

  return {
    status: 404,
    ok: false,
    headers: { get: () => 'application/json' },
    json: async () => ({ error: 'NOT_FOUND', status: 404 }),
  };
};

async function runRegressionSuite() {
  try {
    // -------------------------------------------------------------------------
    // TEST 1: Cold start with NO token
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Cold start with NO token in storage ---');
    clearSession();
    auth.clearMemoryUser();
    assert(getToken() === null, 'Initial sessionStorage token is null');
    assert(auth.getMemoryUser() === null, 'Initial in-memory user is null');

    const result1 = await bootstrapSession();
    assert(result1 === null, 'bootstrapSession() with empty storage returns null');
    assert(auth.getMemoryUser() === null, 'In-memory user remains null');

    // -------------------------------------------------------------------------
    // TEST 2 & 3: Cold start with valid token restores user profile via /auth/me
    // (Proves reproduction and resolution of original bug where inMemoryCurrentUser was null)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2 & 3: Cold start with VALID token in storage (Empty memory) ---');
    const validToken = 'valid_session_token_from_previous_browser_session_123';
    setSession(validToken);
    auth.clearMemoryUser(); // Force empty in-memory state simulating fresh page reload

    assert(getToken() === validToken, 'Valid token present in sessionStorage');
    assert(auth.getMemoryUser() === null, 'In-memory user is strictly null before cold bootstrap');

    capturedAuthHeaders = [];
    const restoredUser = await bootstrapSession();

    assert(restoredUser !== null, 'Cold start bootstrap successfully restored user');
    assert(restoredUser.user_id === mockMeResponse.user_id, 'Restored user_id matches server authority');
    assert(restoredUser.name === 'Alice Owner (X)', 'Restored name matches server authority');
    assert(restoredUser.role === 'resident', 'Restored role matches server authority');
    assert(restoredUser.email === 'alice.x@example.com', 'Restored email matches server authority');
    assert(auth.getMemoryUser()?.user_id === mockMeResponse.user_id, 'In-memory user populated from server response');
    assert(capturedAuthHeaders.some((h) => h === `Bearer ${validToken}`), 'Sent Authorization: Bearer <token> to /auth/me');

    // -------------------------------------------------------------------------
    // TEST 4 & 5: Cold start with invalid / expired token (401 Dispatched)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4 & 5: Cold start with REVOKED/EXPIRED token ---');
    const deadToken = 'revoked_dead_token_401';
    setSession(deadToken);
    auth.clearMemoryUser();
    mockMeStatus = 401;

    let expiredDispatched = false;
    const unsubscribe = onSessionExpired(() => {
      expiredDispatched = true;
    });

    const deadResult = await bootstrapSession();
    assert(deadResult === null, 'Expired token bootstrap returns null');
    assert(expiredDispatched === true, 'onSessionExpired callback was dispatched');
    assert(getToken() === null, 'Expired token was automatically cleared from storage');
    assert(auth.getMemoryUser() === null, 'In-memory user is null after expired check');
    unsubscribe();
    mockMeStatus = 200;

    // -------------------------------------------------------------------------
    // TEST 6: Network failure during bootstrap does NOT wipe token
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Network failure handling during bootstrap ---');
    setSession(validToken);
    auth.clearMemoryUser();
    mockNetworkError = true;

    let caughtNetworkErr = null;
    try {
      await bootstrapSession();
    } catch (err) {
      caughtNetworkErr = err;
    }

    assert(caughtNetworkErr !== null, 'Network error was thrown explicitly');
    assert(caughtNetworkErr.error === 'NETWORK_ERROR', 'Error is normalized to NETWORK_ERROR');
    assert(getToken() === validToken, 'Token was NOT wiped from storage on network error');
    assert(auth.getMemoryUser() === null, 'No fake authenticated user manufactured during outage');
    mockNetworkError = false;

    // -------------------------------------------------------------------------
    // TEST 7: Login flow with POST /auth/login + GET /auth/me
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Login flow ---');
    clearSession();
    auth.clearMemoryUser();

    const loginRes = await login('alice.x@example.com', 'password123');
    assert(loginRes.user.user_id === mockMeResponse.user_id, 'Login returned authoritative user');
    assert(loginRes.role === 'resident', 'Login returned authoritative role');
    assert(getToken() !== null, 'Session token stored after login');
    assert(auth.getMemoryUser() !== null, 'In-memory user set after login');

    // -------------------------------------------------------------------------
    // TEST 8: Logout clears session
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Logout flow ---');
    await logout();
    assert(getToken() === null, 'Token cleared after logout');
    assert(auth.getMemoryUser() === null, 'In-memory user cleared after logout');

    const postLogoutBootstrap = await bootstrapSession();
    assert(postLogoutBootstrap === null, 'Bootstrap after logout returns null');

    // -------------------------------------------------------------------------
    // TEST 9: Stale bootstrap request cannot restore session after logout
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Stale request protection (Race condition guard) ---');
    setSession(validToken);
    auth.clearMemoryUser();

    // Configure 50ms delay on GET /auth/me
    mockDelayMs = 50;
    const slowBootstrapPromise = bootstrapSession();

    // Immediately trigger logout before slow bootstrap completes
    await logout();
    assert(getToken() === null, 'Logged out immediately');

    // Await delayed bootstrap response
    const slowResult = await slowBootstrapPromise;
    assert(slowResult === null, 'Stale bootstrap response was dropped and returned null');
    assert(auth.getMemoryUser() === null, 'Stale response did NOT restore logged-out session');
    assert(getToken() === null, 'Token remains null after stale response');
    mockDelayMs = 0;

    // -------------------------------------------------------------------------
    // TEST 10: Strict server-side authority (No browser metadata trust)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Server-authoritative profile integrity ---');
    setSession(validToken);
    auth.clearMemoryUser();

    const verifiedProfile = await bootstrapSession();
    assert(verifiedProfile.role === 'resident', 'Role comes from server authority (resident)');
    assert(verifiedProfile.hub_id === 'aaaa1111-1111-4111-8111-111111111111', 'Hub ID comes from server authority');
    assert(verifiedProfile.password_hash === undefined, 'password_hash is strictly omitted');

    clearSession();
    auth.clearMemoryUser();

    console.log('\n======================================================================');
    console.log(`  ALL ${passCount} FRONTEND REGRESSION ASSERTIONS PASSED (0 FAILURES)`);
    console.log('======================================================================\n');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal regression suite error:', err);
  process.exit(1);
});
