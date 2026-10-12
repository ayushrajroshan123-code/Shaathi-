/**
 * SAATHI Phase 2G-6 Step 2 Queries Integration Test Suite
 * Validates Frontend API Client for Neighborhood Queries Lifecycle.
 */

import { apiClient, ApiError, clearSession } from './client.js';
import { login, logout } from './auth.js';
import {
  createQuery,
  addAnswer,
  markAnswerHelpful,
  clearHelpfulAnswer,
  resolveQuery,
  listQueries,
  reportQuery,
  reportAnswer,
  deleteQuery,
  deleteAnswer,
  getQuery,
  listAnswers
} from './queries.js';

console.log('======================================================================');
console.log('  SAATHI PHASE 2G-6 STEP 2 QUERIES INTEGRATION SUITE');
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
  const PASSWORD = 'password123';

  let createdQuery = null;
  let createdAnswer = null;

  try {
    // ---------------------------------------------------------------------------
    // 1. CREATE QUERY (ALICE)
    // ---------------------------------------------------------------------------
    console.log('\n--- 1. Create Query ---');
    await login(ALICE_EMAIL, PASSWORD);
    createdQuery = await createQuery({ title: 'Need a rake', body: 'Does anyone have a rake?' });
    const qId = createdQuery.query_id || createdQuery.id;
    assert(qId, 'Query created successfully');
    
    // ---------------------------------------------------------------------------
    // 2. ADD ANSWER (BOB)
    // ---------------------------------------------------------------------------
    console.log('\n--- 2. Add Answer ---');
    await login(BOB_EMAIL, PASSWORD);
    createdAnswer = await addAnswer(qId, { body: 'I have a rake you can use.' });
    assert(createdAnswer && createdAnswer.answer_id, 'Answer added successfully');

    // ---------------------------------------------------------------------------
    // 3. NON-CREATOR CANNOT MARK HELPFUL (BOB)
    // ---------------------------------------------------------------------------
    console.log('\n--- 3. Non-creator Cannot Mark Helpful ---');
    let helpfulError = null;
    try {
      await markAnswerHelpful(qId, createdAnswer.answer_id);
    } catch (err) {
      helpfulError = err;
    }
    assert(helpfulError instanceof ApiError, 'Non-creator marking helpful throws ApiError');

    // ---------------------------------------------------------------------------
    // 4. CREATOR MARKS HELPFUL (ALICE)
    // ---------------------------------------------------------------------------
    console.log('\n--- 4. Creator Marks Helpful ---');
    await login(ALICE_EMAIL, PASSWORD);
    const helpfulResp = await markAnswerHelpful(qId, createdAnswer.answer_id);
    assert(helpfulResp, 'Creator marked answer helpful successfully');

    // ---------------------------------------------------------------------------
    // 5. CREATOR CLEARS HELPFUL (ALICE)
    // ---------------------------------------------------------------------------
    console.log('\n--- 5. Creator Clears Helpful ---');
    const clearResp = await clearHelpfulAnswer(qId, createdAnswer.answer_id);
    assert(clearResp !== undefined, 'Creator cleared helpful mark successfully');

    // ---------------------------------------------------------------------------
    // 6. BOB REPORTS QUERY
    // ---------------------------------------------------------------------------
    console.log('\n--- 6. Bob Reports Query ---');
    await login(BOB_EMAIL, PASSWORD);
    const qReport = await reportQuery(qId, { category: 'spam', description: 'This query is spam' });
    assert(qReport && qReport.report_id, 'Bob reported query successfully');

    // ---------------------------------------------------------------------------
    // 7. ALICE CANNOT REPORT HER OWN QUERY
    // ---------------------------------------------------------------------------
    console.log('\n--- 7. Alice Cannot Report Her Own Query ---');
    await login(ALICE_EMAIL, PASSWORD);
    let ownQReportErr = null;
    try {
      await reportQuery(qId, { category: 'spam', description: 'self report' });
    } catch(err) {
      ownQReportErr = err;
    }
    assert(ownQReportErr instanceof ApiError, 'Alice cannot report her own query');

    // ---------------------------------------------------------------------------
    // 8. ALICE REPORTS BOB'S ANSWER
    // ---------------------------------------------------------------------------
    console.log('\n--- 8. Alice Reports Bob\'s Answer ---');
    const aReport = await reportAnswer(qId, createdAnswer.answer_id, { category: 'harassment', description: 'mean answer' });
    assert(aReport && aReport.report_id, 'Alice reported answer successfully');

    // ---------------------------------------------------------------------------
    // 9. ALICE CANNOT REPORT ANSWER TWICE
    // ---------------------------------------------------------------------------
    console.log('\n--- 9. Alice Cannot Report Answer Twice ---');
    let doubleReportErr = null;
    try {
      await reportAnswer(qId, createdAnswer.answer_id, { category: 'spam' });
    } catch(err) {
      doubleReportErr = err;
    }
    assert(doubleReportErr instanceof ApiError && doubleReportErr.status === 409, 'Duplicate report is prevented');

    // ---------------------------------------------------------------------------
    // 10. CREATOR RESOLVES QUERY (ALICE)
    // ---------------------------------------------------------------------------
    console.log('\n--- 10. Creator Resolves Query ---');
    const resolveResp = await resolveQuery(qId);
    assert(resolveResp !== undefined, 'Creator resolved query successfully');

    // ---------------------------------------------------------------------------
    // 11. CANNOT ADD ANSWER TO RESOLVED QUERY (BOB)
    // ---------------------------------------------------------------------------
    console.log('\n--- 11. Cannot Add Answer to Resolved Query ---');
    await login(BOB_EMAIL, PASSWORD);
    let resolvedError = null;
    try {
      await addAnswer(qId, { body: 'Another rake here' });
    } catch (err) {
      resolvedError = err;
    }
    assert(resolvedError instanceof ApiError, 'Adding answer to resolved query throws ApiError');

    // ---------------------------------------------------------------------------
    // 12. BOB CANNOT DELETE ALICE'S QUERY
    // ---------------------------------------------------------------------------
    console.log('\n--- 12. Bob Cannot Delete Alice\'s Query ---');
    await login(BOB_EMAIL, PASSWORD);
    let bobDeleteErr = null;
    try {
      await deleteQuery(qId);
    } catch(err) {
      bobDeleteErr = err;
    }
    assert(bobDeleteErr instanceof ApiError, 'Bob cannot delete Alice\'s query');

    // ---------------------------------------------------------------------------
    // 13. BOB DELETES HIS ANSWER
    // ---------------------------------------------------------------------------
    console.log('\n--- 13. Bob Deletes His Answer ---');
    await deleteAnswer(qId, createdAnswer.answer_id);
    const answersAfterDelete = await listAnswers(qId);
    assert(!answersAfterDelete.some(a => a.answer_id === createdAnswer.answer_id), 'Deleted answer is hidden from list');

    // ---------------------------------------------------------------------------
    // 14. ALICE DELETES HER QUERY
    // ---------------------------------------------------------------------------
    console.log('\n--- 14. Alice Deletes Her Query ---');
    await login(ALICE_EMAIL, PASSWORD);
    await deleteQuery(qId);
    const queriesAfterDelete = await listQueries();
    assert(!queriesAfterDelete.some(q => (q.query_id || q.id) === qId), 'Deleted query is hidden from list');
    
    let getQueryErr = null;
    try {
      await getQuery(qId);
    } catch(err) {
      getQueryErr = err;
    }
    assert(getQueryErr instanceof ApiError && getQueryErr.status === 404, 'Deleted query returns 404');

  } catch (err) {
    console.error('UNEXPECTED ERROR:', err);
    failCount++;
  } finally {
    console.log('\n======================================================================');
    console.log(`  SUITE COMPLETED. PASSED: ${passCount}, FAILED: ${failCount}`);
    console.log('======================================================================\n');
    process.exit(failCount > 0 ? 1 : 0);
  }
}

runSuite();
