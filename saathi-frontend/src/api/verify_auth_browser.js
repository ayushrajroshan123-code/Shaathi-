/**
 * SAATHI Phase 2G-1 End-to-End Browser Authentication Verification
 * Tests the real interactive React application in Edge via Playwright-core.
 */

import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

console.log('=== STARTING SAATHI PHASE 2G-1 BROWSER AUTH VERIFICATION ===');

async function runBrowserVerification() {
  // 1. Start Vite development server programmatically
  console.log('1. Starting Vite server...');
  const vite = await createViteServer({
    root: rootDir,
    server: { port: 5173, host: 'localhost' },
    logLevel: 'error',
  });
  await vite.listen();
  const serverUrl = 'http://localhost:5173';
  console.log(`Vite server running at: ${serverUrl}`);

  // 2. Launch headless Edge
  console.log('2. Launching Edge browser...');
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleLogs.push(msg.text());
    }
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Direct navigation to #dashboard without session -> routes to #login
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Unauthenticated #dashboard access redirect ---');
    await page.goto(`${serverUrl}/#dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // Verify Login page is rendered
    const loginHeader = await page.textContent('.login-title');
    console.log('Found page title:', loginHeader);
    if (!loginHeader || !loginHeader.includes('SAATHI')) {
      throw new Error(`Expected login page but found: ${loginHeader}`);
    }

    const tokenBeforeLogin = await page.evaluate(() => sessionStorage.getItem('saathi_session_token'));
    if (tokenBeforeLogin !== null) {
      throw new Error(`Token should be null before login, but found: ${tokenBeforeLogin}`);
    }
    console.log('✅ TEST 1 PASSED: Unauthenticated dashboard access prevented, redirected to login.');

    // -------------------------------------------------------------------------
    // TEST 2: Invalid login credentials rejection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Invalid credentials rejection ---');
    await page.fill('#loginEmail', 'alice.x@example.com');
    await page.fill('#loginPassword', 'badpassword999');
    await page.click('button[type="submit"]');

    // Wait for error banner
    await page.waitForSelector('.login-alert-banner.error', { timeout: 5000 });
    const errorText = await page.textContent('.login-alert-banner.error');
    console.log('Error displayed:', errorText);
    if (!errorText || (!errorText.toLowerCase().includes('invalid') && !errorText.toLowerCase().includes('password'))) {
      throw new Error(`Expected error banner with invalid credentials text, got: ${errorText}`);
    }

    const tokenAfterInvalid = await page.evaluate(() => sessionStorage.getItem('saathi_session_token'));
    if (tokenAfterInvalid !== null) {
      throw new Error(`Token should not be stored after invalid login, got: ${tokenAfterInvalid}`);
    }
    console.log('✅ TEST 2 PASSED: Invalid credentials properly rejected by backend and error displayed.');

    // -------------------------------------------------------------------------
    // TEST 3: Valid login -> token stored -> real dashboard displayed
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Valid authentication & dashboard entry ---');
    await page.fill('#loginEmail', 'alice.x@example.com');
    await page.fill('#loginPassword', 'password123');
    await page.click('button[type="submit"]');

    // Wait for Dashboard greeting
    await page.waitForSelector('.greeting-headline', { timeout: 8000 });
    const greetingText = await page.textContent('.greeting-headline');
    console.log('Dashboard greeting:', greetingText);
    if (!greetingText.includes('Alice')) {
      throw new Error(`Expected greeting for Alice, got: ${greetingText}`);
    }

    const storedToken = await page.evaluate(() => sessionStorage.getItem('saathi_session_token'));
    const storedUserId = await page.evaluate(() => sessionStorage.getItem('saathi_user_id'));
    console.log('Stored session token length:', storedToken?.length);
    console.log('Stored user pointer (must be null):', storedUserId);

    if (!storedToken || storedToken.length < 20) {
      throw new Error('Valid token not found in sessionStorage!');
    }
    if (storedUserId !== null) {
      throw new Error(`Strict contract violation: saathi_user_id MUST NOT be stored in sessionStorage, but found: ${storedUserId}`);
    }

    // Verify profile menu displays authentic Alice Owner
    await page.click('.topbar-avatar-btn');
    await page.waitForSelector('.topbar-profile-dropdown');
    const dropdownName = await page.textContent('.dropdown-name');
    const dropdownRole = await page.textContent('.dropdown-role');
    console.log(`Dropdown user: ${dropdownName} (${dropdownRole})`);
    if (!dropdownName.includes('Alice Owner')) {
      throw new Error(`Expected Alice Owner in dropdown, got: ${dropdownName}`);
    }
    console.log('✅ TEST 3 PASSED: Valid authentication successful, token stored, saathi_user_id strictly absent, authentic user loaded.');

    // -------------------------------------------------------------------------
    // TEST 4: Logout flow -> token cleared -> returned to #login
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Real logout flow ---');
    await page.click('.dropdown-logout-btn');

    // Wait for Login View to re-appear
    await page.waitForSelector('.saathi-login-page', { timeout: 5000 });
    const postLogoutToken = await page.evaluate(() => sessionStorage.getItem('saathi_session_token'));
    const postLogoutUserId = await page.evaluate(() => sessionStorage.getItem('saathi_user_id'));

    if (postLogoutToken !== null || postLogoutUserId !== null) {
      throw new Error(`Session storage should be cleared after logout, but token=${postLogoutToken}, userId=${postLogoutUserId}`);
    }
    console.log('✅ TEST 4 PASSED: Logout revokes session, clears sessionStorage, and routes to login screen.');

    // -------------------------------------------------------------------------
    // TEST 5: Expired / revoked session (401 notification)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Expired session (401 notification) ---');
    // Inject dead token and reload dashboard (strictly NO user_id in storage)
    await page.evaluate(() => {
      sessionStorage.setItem('saathi_session_token', 'dead_token_for_testing_expired_behavior');
      window.location.hash = '#dashboard';
    });
    await page.reload({ waitUntil: 'networkidle' });

    // Wait for login page
    await page.waitForSelector('.saathi-login-page', { timeout: 5000 });
    const deadTokenAfterCheck = await page.evaluate(() => sessionStorage.getItem('saathi_session_token'));
    if (deadTokenAfterCheck !== null) {
      throw new Error(`Dead token was not cleared after 401, found: ${deadTokenAfterCheck}`);
    }
    console.log('✅ TEST 5 PASSED: Expired session detected, token wiped, user returned to login.');

    console.log('\n======================================================================');
    console.log('  ALL BROWSER AUTHENTICATION CHECKS PASSED SUCCESSFULLY (0 FAILURES)');
    console.log('======================================================================\n');
  } finally {
    await browser.close();
    await vite.close();
  }
}

runBrowserVerification().catch((err) => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
