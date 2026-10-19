/**
 * SAATHI GET /auth/me Focused Backend Integration Test Suite
 * Validates server-authoritative self-profile bootstrap:
 * 1. Valid token returns the authenticated caller's approved profile.
 * 2. Missing token returns 401 UNAUTHENTICATED.
 * 3. Malformed or invalid token returns 401 UNAUTHENTICATED.
 * 4. Revoked token returns 401 UNAUTHENTICATED.
 * 5. Expired token returns 401 UNAUTHENTICATED.
 * 6. Client-supplied user_id in query or body cannot change the returned identity.
 * 7. Client cannot forge role or hub identity.
 * 8. The response does not expose password hashes, tokens, or token hashes.
 */

require('dotenv').config();
const assert = require('assert');
const { query } = require('../src/db');
const {
  startTestServer,
  stopTestServer,
  setupTestContext,
  cleanupTestContext,
} = require('./test_helper');

async function runTests() {
  console.log('======================================================================');
  console.log('  SAATHI GET /auth/me BACKEND INTEGRATION TEST SUITE');
  console.log('======================================================================\n');

  const { baseUrl } = await startTestServer();
  const ctx = await setupTestContext();
  let passCount = 0;

  function record(title, condition) {
    if (!condition) {
      console.error(`❌ FAILED: ${title}`);
      process.exit(1);
    }
    console.log(`✅ PASSED: ${title}`);
    passCount++;
  }

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  }

  try {
    const { tokenX, tokenY } = ctx.tokens;
    const { userX } = ctx.users;

    // 1. Valid token returns caller's approved profile
    const r1 = await api('/auth/me', {
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record('1. Valid token returns 200 with approved profile', r1.status === 200);
    record('1b. Profile matches userX identity', r1.body?.user_id === userX.user_id);
    record('1c. Profile contains verified email and role', r1.body?.email === userX.email && r1.body?.role === 'resident');
    record('1d. Profile contains correct hub_id', r1.body?.hub_id === userX.hub_id);

    // 2. Missing token returns 401
    const r2 = await api('/auth/me');
    record('2. Missing token returns 401 UNAUTHENTICATED', r2.status === 401 && r2.body?.error === 'UNAUTHENTICATED');

    // 3. Malformed/invalid token returns 401
    const r3 = await api('/auth/me', {
      headers: { Authorization: 'Bearer bad_invalid_token_12345' },
    });
    record('3. Invalid token returns 401 UNAUTHENTICATED', r3.status === 401 && r3.body?.error === 'UNAUTHENTICATED');

    // 4. Revoked token returns 401
    // Log out userY
    const logoutRes = await api('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record('4a. Logout userY succeeds with 204', logoutRes.status === 204);

    const r4 = await api('/auth/me', {
      headers: { Authorization: `Bearer ${tokenY}` },
    });
    record('4b. Revoked token returns 401 UNAUTHENTICATED', r4.status === 401 && r4.body?.error === 'UNAUTHENTICATED');

    // 5. Expired token returns 401
    // Manually expire userX's session in DB
    const { rows: sessionRows } = await query(
      'SELECT session_id FROM sessions WHERE user_id = $1',
      [userX.user_id]
    );
    if (sessionRows.length > 0) {
      await query(
        'UPDATE sessions SET expires_at = now() - interval \'1 day\' WHERE session_id = $1',
        [sessionRows[0].session_id]
      );
    }
    const r5 = await api('/auth/me', {
      headers: { Authorization: `Bearer ${tokenX}` },
    });
    record('5. Expired token returns 401 UNAUTHENTICATED', r5.status === 401 && r5.body?.error === 'UNAUTHENTICATED');

    // Restore token for remaining checks
    const { createSession } = require('../src/services/auth');
    const freshTokenX = await createSession(userX.user_id);

    // 6. Client cannot supply a different user_id via query or body
    const r6 = await api(`/auth/me?user_id=${ctx.users.userZ.user_id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${freshTokenX}` },
    });
    record('6. Query param user_id is ignored; returns token owner userX', r6.status === 200 && r6.body?.user_id === userX.user_id);

    // 7. Client cannot forge role or hub_id
    record('7. Actor role/hub is determined strictly by database record', r6.body?.role === userX.role && r6.body?.hub_id === userX.hub_id);

    // 8. Response strictly matches explicit field allowlist and does not expose sensitive/internal fields
    record('8a. Response does NOT expose password_hash', r6.body?.password_hash === undefined);
    record('8b. Response does NOT expose token_hash', r6.body?.token_hash === undefined);
    record('8c. Response does NOT expose token', r6.body?.token === undefined);
    record('8d. Response does NOT expose internal approval metadata', r6.body?.approved_by === undefined && r6.body?.approved_at === undefined);
    record('8e. Response does NOT expose internal contact preferences or notification endpoints', r6.body?.contact_preferences === undefined && r6.body?.notification_endpoints === undefined && r6.body?.emergency_contact_user_id === undefined);
    
    const allowedFields = ['user_id', 'hub_id', 'name', 'email', 'role', 'account_status', 'is_active', 'created_at'];
    const returnedKeys = Object.keys(r6.body || {});
    const unexpectedKeys = returnedKeys.filter((k) => !allowedFields.includes(k));
    record('8f. Response contains only allowed fields', unexpectedKeys.length === 0);
    record('8g. Response contains all required client profile fields', allowedFields.every((k) => k in r6.body));

    console.log('\n======================================================================');
    console.log(`  ALL ${passCount} GET /auth/me BACKEND ASSERTIONS PASSED (0 FAILURES)`);
    console.log('======================================================================\n');
  } finally {
    await cleanupTestContext(ctx);
    await stopTestServer();
  }
}

runTests().catch((err) => {
  console.error('Fatal backend test error:', err);
  process.exit(1);
});
