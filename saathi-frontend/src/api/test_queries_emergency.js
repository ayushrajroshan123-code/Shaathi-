/**
 * SAATHI Phase 2G-6 Step 5 Emergency Mode Integration Test
 */

import { apiClient, ApiError } from './client.js';
import { login } from './auth.js';
import {
  createQuery,
  addAnswer,
  resolveQuery,
  reportQuery,
  reportAnswer
} from './queries.js';
import { execSync } from 'child_process';

console.log('======================================================================');
console.log('  SAATHI PHASE 2G-6 STEP 5 EMERGENCY MODE INTEGRATION TEST');
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

function setEmergencyMode(mode) {
  console.log(`\n--- Turning Emergency Mode ${mode ? 'ON' : 'OFF'} via DB Script ---`);
  execSync(`node saathi-api-updated-003/saathi-api-updated/scripts/toggle_emergency.js ${mode}`, { stdio: 'inherit' });
}

async function runSuite() {
  const ALICE_EMAIL = 'alice.x@example.com';
  const BOB_EMAIL = 'bob.y@example.com';
  const PASSWORD = 'password123';

  try {
    // 1. Setup Data Before Emergency Mode
    console.log('\n--- 1. Setup Query and Answer ---');
    await login(ALICE_EMAIL, PASSWORD);
    const q = await createQuery({ title: 'Pre-emergency query', body: 'This is visible.' });
    const qId = q.query_id || q.id;
    assert(qId, 'Query created successfully');

    await login(BOB_EMAIL, PASSWORD);
    const ans = await addAnswer(qId, { body: 'Pre-emergency answer' });
    assert(ans.answer_id, 'Answer added successfully');

    // Resolve the query
    await login(ALICE_EMAIL, PASSWORD);
    await resolveQuery(qId);
    assert(true, 'Query resolved');

    // 2. Enable Emergency Mode
    setEmergencyMode(true);

    // 3. Verify Creation is Blocked
    console.log('\n--- 2. Verify Creation is Blocked ---');
    await login(ALICE_EMAIL, PASSWORD);
    let createQErr = null;
    try {
      await createQuery({ title: 'Emergency query', body: 'Should fail.' });
    } catch(err) { createQErr = err; }
    assert(createQErr instanceof ApiError && createQErr.status === 409, 'Query creation blocked in emergency mode');

    // 4. Verify Reporting Still Works
    console.log('\n--- 3. Verify Reporting Works in Emergency Mode ---');
    await login(BOB_EMAIL, PASSWORD); // Bob reports Alice's query
    const qReport = await reportQuery(qId, { category: 'spam', description: 'Reporting during emergency mode' });
    assert(qReport.report_id, 'Reporting query works in emergency mode');

    await login(ALICE_EMAIL, PASSWORD); // Alice reports Bob's answer
    const aReport = await reportAnswer(qId, ans.answer_id, { category: 'spam', description: 'Reporting during emergency mode' });
    assert(aReport.report_id, 'Reporting answer works in emergency mode');

  } catch (err) {
    console.error('UNEXPECTED ERROR:', err);
    failCount++;
  } finally {
    setEmergencyMode(false);
    console.log('\n======================================================================');
    console.log(`  SUITE COMPLETED. PASSED: ${passCount}, FAILED: ${failCount}`);
    console.log('======================================================================\n');
    process.exit(failCount > 0 ? 1 : 0);
  }
}

runSuite();
