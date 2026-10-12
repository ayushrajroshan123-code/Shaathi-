/**
 * SAATHI Phase 2H Step 3: Frontend Environment Configuration & Build Validation Suite
 *
 * Deterministic tests for:
 * 1. getApiBaseUrl() behavior in client.js:
 *    - In development (when VITE_API_BASE_URL is not set): returns 'http://localhost:3000'
 *    - When VITE_API_BASE_URL is configured: returns trimmed URL without trailing slash
 *    - In production (when VITE_API_BASE_URL is missing): throws Error
 * 2. Vite production build validation:
 *    - Rejects production build when VITE_API_BASE_URL is missing or empty
 *    - Rejects production build when VITE_API_BASE_URL is malformed
 *    - Accepts production build when valid VITE_API_BASE_URL is supplied
 */

import assert from 'assert';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { getApiBaseUrl } from './src/api/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests += 1;
  try {
    fn();
    passedTests += 1;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

console.log('======================================================================');
console.log('  SAATHI FRONTEND ENVIRONMENT & BUILD VALIDATION SUITE (PHASE 2H STEP 3)');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// 1. Runtime / Client Base URL Resolution
// ---------------------------------------------------------------------------
test('getApiBaseUrl returns configured URL trimmed without trailing slash', () => {
  const origEnv = process.env.VITE_API_BASE_URL;
  try {
    process.env.VITE_API_BASE_URL = '  https://api.saathi.community/  ';
    assert.strictEqual(getApiBaseUrl(), 'https://api.saathi.community');
  } finally {
    if (origEnv !== undefined) process.env.VITE_API_BASE_URL = origEnv;
    else delete process.env.VITE_API_BASE_URL;
  }
});

test('getApiBaseUrl defaults to http://localhost:3000 in development when unset', () => {
  const origEnv = process.env.VITE_API_BASE_URL;
  const origNodeEnv = process.env.NODE_ENV;
  try {
    delete process.env.VITE_API_BASE_URL;
    process.env.NODE_ENV = 'development';
    assert.strictEqual(getApiBaseUrl(), 'http://localhost:3000');
  } finally {
    if (origEnv !== undefined) process.env.VITE_API_BASE_URL = origEnv;
    else delete process.env.VITE_API_BASE_URL;
    if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
    else delete process.env.NODE_ENV;
  }
});

test('getApiBaseUrl throws in production when VITE_API_BASE_URL is missing', () => {
  const origEnv = process.env.VITE_API_BASE_URL;
  const origNodeEnv = process.env.NODE_ENV;
  try {
    delete process.env.VITE_API_BASE_URL;
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => getApiBaseUrl(),
      /VITE_API_BASE_URL is missing in production environment/
    );
  } finally {
    if (origEnv !== undefined) process.env.VITE_API_BASE_URL = origEnv;
    else delete process.env.VITE_API_BASE_URL;
    if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
    else delete process.env.NODE_ENV;
  }
});

// ---------------------------------------------------------------------------
// 2. Vite Build-Time Validation
// ---------------------------------------------------------------------------
test('Vite build rejects production build when VITE_API_BASE_URL is missing or empty', () => {
  let threw = false;
  try {
    // Pass empty VITE_API_BASE_URL to override any .env file
    execSync('npx vite build --mode production', {
      cwd: __dirname,
      env: { ...process.env, VITE_API_BASE_URL: '' },
      stdio: 'pipe',
    });
  } catch (err) {
    threw = true;
    const output = (err.stderr?.toString() || '') + (err.stdout?.toString() || '');
    assert.ok(
      output.includes('Production build failed: VITE_API_BASE_URL is required') ||
      output.includes('VITE_API_BASE_URL is required for production builds'),
      `Expected missing VITE_API_BASE_URL error message, got: ${output}`
    );
  }
  assert.strictEqual(threw, true, 'Build must fail when VITE_API_BASE_URL is missing');
});

test('Vite build rejects production build when VITE_API_BASE_URL is invalid', () => {
  let threw = false;
  try {
    execSync('npx vite build --mode production', {
      cwd: __dirname,
      env: { ...process.env, VITE_API_BASE_URL: 'not-a-valid-url' },
      stdio: 'pipe',
    });
  } catch (err) {
    threw = true;
    const output = (err.stderr?.toString() || '') + (err.stdout?.toString() || '');
    assert.ok(
      output.includes('is not a valid URL') || output.includes('Invalid protocol'),
      `Expected invalid URL error message, got: ${output}`
    );
  }
  assert.strictEqual(threw, true, 'Build must fail when VITE_API_BASE_URL is malformed');
});

test('Vite build succeeds when valid production VITE_API_BASE_URL is provided', () => {
  const result = execSync('npx vite build --mode production', {
    cwd: __dirname,
    env: { ...process.env, VITE_API_BASE_URL: 'https://api.saathi.community' },
    stdio: 'pipe',
  });
  const output = result.toString();
  assert.ok(output.includes('built in'), 'Build must succeed and report completion');
});

console.log('\n======================================================================');
console.log(`  SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('======================================================================');
