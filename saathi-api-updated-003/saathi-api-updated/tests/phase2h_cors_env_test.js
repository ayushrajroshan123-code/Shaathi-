/**
 * SAATHI Phase 2H Step 3: CORS Standardization and Environment Configuration Suite
 *
 * Deterministic tests for:
 * 1. Safe parsing of comma-separated origins (whitespace trimming, empty entries ignored).
 * 2. Origin normalization (trailing slashes stripped to match standard browser Origin headers).
 * 3. Default fallback in development (http://localhost:5173, http://127.0.0.1:5173).
 * 4. Production fail-closed behavior on missing or empty ALLOWED_ORIGINS.
 * 5. Production rejection of wildcard origins ('*', '*.domain.com').
 * 6. Production rejection of malformed origins (non-HTTP/HTTPS protocols, paths, queries, hashes).
 * 7. HTTP layer verification:
 *    - Approved origin receives Access-Control-Allow-Origin & credentials.
 *    - Unapproved origin receives no Access-Control-Allow-Origin header.
 *    - Request without Origin header succeeds with HTTP 200 (CLI/curl/service access).
 */

const assert = require('assert');
const http = require('http');
const app = require('../src/app');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests += 1;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res
        .then(() => {
          passedTests += 1;
          console.log(`[PASS] ${name}`);
        })
        .catch((err) => {
          console.error(`[FAIL] ${name}:`, err.message);
          throw err;
        });
    }
    passedTests += 1;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function request(server, path, headers = {}) {
  const address = server.address();
  const port = address.port;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runSuite() {
  console.log('======================================================================');
  console.log('  SAATHI CORS & ENVIRONMENT CONFIGURATION SUITE (PHASE 2H STEP 3)');
  console.log('======================================================================\n');

  const { resolveAllowedOrigins } = app;
  assert.strictEqual(typeof resolveAllowedOrigins, 'function', 'resolveAllowedOrigins must be exported on app');

  // -------------------------------------------------------------------------
  // 1. Parsing & Normalization
  // -------------------------------------------------------------------------
  test('resolveAllowedOrigins parses comma-separated origins and trims whitespace', () => {
    const raw = '  https://saathi.community  ,   http://localhost:5173  ';
    const parsed = resolveAllowedOrigins(raw, 'development');
    assert.deepStrictEqual(parsed, ['https://saathi.community', 'http://localhost:5173']);
  });

  test('resolveAllowedOrigins safely filters out empty comma entries', () => {
    const raw = 'https://saathi.community,, ,http://localhost:5173,';
    const parsed = resolveAllowedOrigins(raw, 'development');
    assert.deepStrictEqual(parsed, ['https://saathi.community', 'http://localhost:5173']);
  });

  test('resolveAllowedOrigins normalizes origins with trailing slashes', () => {
    const raw = 'https://saathi.community/';
    const parsed = resolveAllowedOrigins(raw, 'development');
    assert.deepStrictEqual(parsed, ['https://saathi.community']);
  });

  test('resolveAllowedOrigins preserves local-development default when unset in dev', () => {
    const parsed = resolveAllowedOrigins('', 'development');
    assert.deepStrictEqual(parsed, ['http://localhost:5173', 'http://127.0.0.1:5173']);

    const parsedNull = resolveAllowedOrigins(null, 'test');
    assert.deepStrictEqual(parsedNull, ['http://localhost:5173', 'http://127.0.0.1:5173']);
  });

  // -------------------------------------------------------------------------
  // 2. Production Fail-Closed Behavior
  // -------------------------------------------------------------------------
  test('resolveAllowedOrigins fails closed in production when ALLOWED_ORIGINS is missing or empty', () => {
    assert.throws(
      () => resolveAllowedOrigins('', 'production'),
      /ALLOWED_ORIGINS environment variable is required and must not be empty in production/
    );
    assert.throws(
      () => resolveAllowedOrigins(null, 'production'),
      /ALLOWED_ORIGINS environment variable is required and must not be empty in production/
    );
    assert.throws(
      () => resolveAllowedOrigins('   ,  ,  ', 'production'),
      /ALLOWED_ORIGINS environment variable is required and must not be empty in production/
    );
  });

  test('resolveAllowedOrigins rejects wildcard origins in production', () => {
    assert.throws(
      () => resolveAllowedOrigins('*', 'production'),
      /Wildcard origins are not permitted in ALLOWED_ORIGINS/
    );
    assert.throws(
      () => resolveAllowedOrigins('https://*.saathi.community', 'production'),
      /Wildcard origins are not permitted in ALLOWED_ORIGINS/
    );
    assert.throws(
      () => resolveAllowedOrigins('https://saathi.community, *', 'production'),
      /Wildcard origins are not permitted in ALLOWED_ORIGINS/
    );
  });

  test('resolveAllowedOrigins rejects malformed origins in production', () => {
    // Non-URL string
    assert.throws(
      () => resolveAllowedOrigins('not-a-valid-origin', 'production'),
      /Invalid origin in ALLOWED_ORIGINS/
    );
    // Non-HTTP/HTTPS protocol
    assert.throws(
      () => resolveAllowedOrigins('ftp://saathi.community', 'production'),
      /Invalid protocol/
    );
    // Origin containing pathname
    assert.throws(
      () => resolveAllowedOrigins('https://saathi.community/api', 'production'),
      /Origin must not contain a path/
    );
    // Origin containing query or hash
    assert.throws(
      () => resolveAllowedOrigins('https://saathi.community?utm=1', 'production'),
      /Origin must not contain query parameters or hashes/
    );
  });

  test('resolveAllowedOrigins accepts valid production configuration with multiple origins', () => {
    const raw = 'https://saathi.community, https://app.saathi.community, https://admin.saathi.community:8443';
    const parsed = resolveAllowedOrigins(raw, 'production');
    assert.deepStrictEqual(parsed, [
      'https://saathi.community',
      'https://app.saathi.community',
      'https://admin.saathi.community:8443',
    ]);
  });

  // -------------------------------------------------------------------------
  // 3. HTTP Layer CORS Enforcement
  // -------------------------------------------------------------------------
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    await test('HTTP request with approved origin returns Access-Control-Allow-Origin and credentials', async () => {
      // Local dev default includes http://localhost:5173
      const res = await request(server, '/health/live', {
        Origin: 'http://localhost:5173',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:5173');
      assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
    });

    await test('HTTP request with unapproved origin does NOT reflect origin or grant access', async () => {
      const res = await request(server, '/health/live', {
        Origin: 'https://malicious-site.example.com',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers['access-control-allow-origin'], undefined, 'Must not set Allow-Origin for unapproved origin');
    });

    await test('HTTP request with no Origin header succeeds normally (CLI/curl/service access)', async () => {
      const res = await request(server, '/health/live');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
      const json = JSON.parse(res.body);
      assert.strictEqual(json.status, 'ok');
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n======================================================================');
  console.log(`  SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('======================================================================');
}

runSuite().catch((err) => {
  console.error('\nTest suite failed:', err);
  process.exit(1);
});
