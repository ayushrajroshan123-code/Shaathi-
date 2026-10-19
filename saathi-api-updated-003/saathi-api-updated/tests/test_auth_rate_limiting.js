const http = require('http');
const assert = require('assert');
const path = require('path');

// Set specific test limits before requiring app/routes
process.env.LOGIN_RATE_LIMIT_MAX = '3';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '600'; // 600ms window for fast reset testing
process.env.SIGNUP_RATE_LIMIT_MAX = '3';
process.env.SIGNUP_RATE_LIMIT_WINDOW_MS = '600';

const app = require('../src/app');
const { createRateLimiter, loginRateLimiter, signupRateLimiter } = require('../src/middleware/rate_limit');

function makeRequest(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  console.log('--- STARTING AUTHENTICATION RATE LIMITING TEST SUITE ---');

  // Reset in-memory limiters to clean state
  loginRateLimiter.reset();
  signupRateLimiter.reset();

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  try {
    // 1. Below limit: 3 login requests succeed with decreasing remaining count
    console.log('\n[Case 1] Requests below limit decrement remaining count');
    for (let i = 1; i <= 3; i++) {
      const res = await makeRequest(port, '/auth/login', {
        body: { email: 'bad@example.com', password: 'wrong' }
      });
      assert.strictEqual(res.headers['x-ratelimit-limit'], '3');
      const expectedRemaining = String(3 - i);
      assert.strictEqual(res.headers['x-ratelimit-remaining'], expectedRemaining);
      assert(res.headers['x-ratelimit-reset'], 'X-RateLimit-Reset must be present');
      assert.strictEqual(res.status, 401);
      console.log(`  Attempt ${i}: Status 401, Remaining: ${expectedRemaining} - PASS`);
    }

    // 2. Excess login attempt receives 429
    console.log('\n[Case 2] 4th attempt receives HTTP 429');
    const excessRes = await makeRequest(port, '/auth/login', {
      body: { email: 'bad@example.com', password: 'wrong' }
    });
    assert.strictEqual(excessRes.status, 429, 'Excess login must return 429');
    assert.strictEqual(excessRes.body.error, 'RATE_LIMIT_EXCEEDED');
    assert.strictEqual(excessRes.headers['x-ratelimit-remaining'], '0');
    assert(Number(excessRes.headers['retry-after']) >= 1, 'Retry-After header must be >= 1 second');
    console.log(`  Attempt 4: Status 429, Retry-After: ${excessRes.headers['retry-after']}s - PASS`);

    // 3. Malformed payload cannot bypass rate limiting
    console.log('\n[Case 3] Malformed payload cannot bypass rate limiting');
    const malformedRes = await makeRequest(port, '/auth/login', {
      body: {}
    });
    assert.strictEqual(malformedRes.status, 429, 'Malformed body still receives 429 under active limit');
    assert.strictEqual(malformedRes.body.error, 'RATE_LIMIT_EXCEEDED');
    console.log('  Malformed request throttled with 429 - PASS');

    // 4. Health and readiness endpoints remain fully operational under rate limit
    console.log('\n[Case 4] Health and readiness endpoints remain unthrottled');
    const healthRes = await makeRequest(port, '/health/live', { method: 'GET' });
    assert.strictEqual(healthRes.status, 200, 'Health liveness must be 200');
    assert.strictEqual(healthRes.body.status, 'ok');
    console.log('  /health/live returned 200 OK while auth is rate-limited - PASS');

    // 5. Window reset after timeout
    console.log('\n[Case 5] Limit resets after window expires');
    await new Promise(r => setTimeout(r, 650)); // wait for 600ms window to expire
    const resetRes = await makeRequest(port, '/auth/login', {
      body: { email: 'bad@example.com', password: 'wrong' }
    });
    assert.strictEqual(resetRes.status, 401, 'Should return 401 instead of 429 after window expiry');
    assert.strictEqual(resetRes.headers['x-ratelimit-remaining'], '2');
    console.log('  Window expired: Attempt allowed and remaining count reset to 2 - PASS');

    // 6. Signup rate limiter operates independently
    console.log('\n[Case 6] Signup rate limiter operates independently');
    for (let i = 1; i <= 3; i++) {
      const res = await makeRequest(port, '/auth/signup', {
        body: { name: 'missing other fields' } // 400 validation error
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.headers['x-ratelimit-limit'], '3');
      assert.strictEqual(res.headers['x-ratelimit-remaining'], String(3 - i));
      console.log(`  Signup Attempt ${i}: Status 400, Remaining: ${3 - i} - PASS`);
    }
    const excessSignupRes = await makeRequest(port, '/auth/signup', {
      body: { name: 'missing other fields' }
    });
    assert.strictEqual(excessSignupRes.status, 429);
    assert.strictEqual(excessSignupRes.body.error, 'RATE_LIMIT_EXCEEDED');
    assert(Number(excessSignupRes.headers['retry-after']) >= 1);
    console.log('  Signup Attempt 4: Status 429 RATE_LIMIT_EXCEEDED - PASS');

    // 7. Multi-client keying isolation
    console.log('\n[Case 7] Separate clients behave according to intended keying strategy');
    const customLimiter = createRateLimiter({
      max: 2,
      windowMs: 10000,
      prefix: 'client_test'
    });
    const headersA = {};
    const headersB = {};
    const mockResA = { set: (k, v) => { headersA[k] = v; } };
    const mockResB = { set: (k, v) => { headersB[k] = v; } };
    let errorA = null;
    let errorB = null;

    const reqClientA = { ip: '10.0.0.1' };
    const reqClientB = { ip: '10.0.0.2' };

    // Client A uses 2 requests
    customLimiter(reqClientA, mockResA, err => { errorA = err; });
    customLimiter(reqClientA, mockResA, err => { errorA = err; });
    assert.strictEqual(headersA['X-RateLimit-Remaining'], '0');

    // Client A 3rd request receives 429
    customLimiter(reqClientA, mockResA, err => { errorA = err; });
    assert(errorA, 'Client A must receive error');
    assert.strictEqual(errorA.status, 429);

    // Client B still has full limit and is NOT throttled by Client A
    customLimiter(reqClientB, mockResB, err => { errorB = err; });
    assert.strictEqual(errorB, undefined, 'Client B must not be throttled');
    assert.strictEqual(headersB['X-RateLimit-Remaining'], '1');
    console.log('  Client A throttled while Client B retains quota - PASS');

    console.log('\n--- ALL AUTHENTICATION RATE LIMITING TESTS PASSED ---');
  } finally {
    // Clean up limiters and server
    loginRateLimiter.reset();
    signupRateLimiter.reset();
    await new Promise(r => server.close(r));
  }
}

run().catch(err => {
  console.error('Rate limiting test failed:', err);
  process.exit(1);
});

