require('dotenv').config();
const { pool, query } = require('../src/db');
const {
  startTestServer,
  stopTestServer,
  setupTestContext,
  cleanupTestContext,
} = require('./test_helper');

async function runTestSuite() {
  const { baseUrl } = await startTestServer();
  const ctx = await setupTestContext();
  const results = [];

  function record(id, title, pass, details = '') {
    results.push({ id, title, status: pass ? 'PASS' : 'FAIL', details });
    console.log(`[Test ${id.toString().padStart(2, '0')}] ${title}: ${pass ? 'PASS' : 'FAIL'}${details ? ' - ' + details : ''}`);
  }

  try {
    const { tokenX: residentToken, tokenY: otherResidentToken } = ctx.tokens;
    const { hubA: hub_id } = ctx.hubs;

    async function api(path, options = {}) {
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
      });
      let body = null;
      try {
        body = await res.json();
      } catch (e) {
        body = null;
      }
      return { status: res.status, body };
    }

    console.log('--- Phase 2G-6 Queries Integration ---');

    async function createQueries(token, count, prefix="Q") {
      const res = [];
      for (let i = 0; i < count; i++) {
        res.push(await api('/queries', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: `${prefix} ${i}`, body: 'Test' }),
        }));
      }
      return res;
    }

    // T01: Invalid submissions not counting
    const invalidRes = await api('/queries', {
       method: 'POST',
       headers: { Authorization: `Bearer ${residentToken}` },
       body: JSON.stringify({ title: '', body: 'bad' }) // invalid
    });
    record(1, 'invalid submissions do not count (returns 400)', invalidRes.status === 400);

    // T02: Emergency Mode rejections not counting
    await query('UPDATE hubs SET emergency_mode = true WHERE hub_id = $1', [hub_id]);
    const emergRes = await api('/queries', {
       method: 'POST',
       headers: { Authorization: `Bearer ${residentToken}` },
       body: JSON.stringify({ title: 'Emerg?', body: 'test' })
    });
    await query('UPDATE hubs SET emergency_mode = false WHERE hub_id = $1', [hub_id]);
    record(2, 'Emergency Mode rejections do not count (returns 409)', emergRes.status === 409);

    // T03: Below-limit, exact-limit, limit-plus-one
    // residentToken (userX) creates 10 queries (limit is 10)
    const exactLimitQueries = await createQueries(residentToken, 10, 'T03');
    const exactSucceed = exactLimitQueries.every(r => r.status === 201);
    
    const limitPlusOne = await api('/queries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${residentToken}` },
      body: JSON.stringify({ title: 'Plus One', body: 'Test' })
    });
    record(3, 'exact-limit succeeds, limit-plus-one fails 429', exactSucceed && limitPlusOne.status === 429);

    // T04: Independent users limit
    // otherResidentToken (userY)
    const otherUserRes = await api('/queries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherResidentToken}` },
      body: JSON.stringify({ title: 'Other user', body: 'Test' })
    });
    record(4, 'independent users limit (other user succeeds)', otherUserRes.status === 201);

    // T05: Independent Query/Answer limits
    // residentToken (userX) hit query limit, can they answer? limit is 20
    const qid = otherUserRes.body.query_id;
    const firstAns = await api(`/queries/${qid}/answers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${residentToken}` },
      body: JSON.stringify({ body: 'Ans 1' })
    });
    record(5, 'independent Query/Answer limits (can answer despite query limit)', firstAns.status === 201);

    // T06: Soft-deleted submissions counting
    // otherResidentToken (userY) has 1 query. Delete it, then try 10 more (should fail at 10th)
    await api(`/queries/${qid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${otherResidentToken}` }
    });
    const moreQueries = await createQueries(otherResidentToken, 10, 'T06');
    const succDel = moreQueries.filter(r => r.status === 201).length;
    const failDel = moreQueries.filter(r => r.status === 429).length;
    record(6, 'soft-deleted submissions count against limit', succDel === 9 && failDel === 1);

    // T07: Rolling-window expiry (expired submission doesn't count)
    // otherResidentToken (userY) has exactly 10 queries. Let's make 1 older than 24h
    await query(`
      UPDATE neighborhood_queries 
      SET created_at = created_at - INTERVAL '25 hours' 
      WHERE query_id IN (
        SELECT query_id FROM neighborhood_queries 
        WHERE creator_id = $1
        LIMIT 1
      )`, [ctx.users.userY.user_id]);
    
    // Now they should have 9 in the 24h window. Let's create 1 more -> success, next -> fail
    const expirySuccess = await api('/queries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherResidentToken}` },
      body: JSON.stringify({ title: 'Expiry Test 1', body: 'Test' })
    });
    const expiryFail = await api('/queries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherResidentToken}` },
      body: JSON.stringify({ title: 'Expiry Test 2', body: 'Test' })
    });
    record(7, 'rolling-window expiry frees up limit allowance', expirySuccess.status === 201 && expiryFail.status === 429);

    // T08: Concurrent boundary requests (Answers)
    // We test concurrent 25 answers by residentToken (userX) on the expirySuccess query.
    // residentToken (userX) already has 1 answer (firstAns). Remaining limit is 19.
    const concurrentQid = expirySuccess.body.query_id;
    const ansPromises = [];
    for (let i = 0; i < 25; i++) {
      ansPromises.push(api(`/queries/${concurrentQid}/answers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${residentToken}` },
        body: JSON.stringify({ body: `Concurrent Ans ${i}` })
      }));
    }
    const ansResults = await Promise.all(ansPromises);
    const ansSucc = ansResults.filter(r => r.status === 201).length;
    const ansFail = ansResults.filter(r => r.status === 429).length;
    record(8, 'concurrent boundary requests reliably handled', ansSucc === 19 && ansFail === 6);

    // --- LIFECYCLE TESTS ---
    await query('TRUNCATE neighborhood_queries CASCADE');

    const makeQuery = async (token) => {
      const r = await api('/queries', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: 'LC Title', body: 'LC Body' }) });
      return r.body;
    };
    const makeAnswer = async (token, qId) => {
      const r = await api(`/queries/${qId}/answers`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ body: 'Ans Body' }) });
      return r.body;
    };
    
    let tIdx = 9;

    // 9. Creator resolves Query
    let q1 = await makeQuery(residentToken);
    let r9 = await api(`/queries/${q1.query_id}/resolve`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });
    record(tIdx++, 'Creator resolves Query', r9.status === 200 && r9.body.status === 'resolved');

    // 10. Non-creator resolves Query
    let q2 = await makeQuery(residentToken);
    let r10 = await api(`/queries/${q2.query_id}/resolve`, { method: 'POST', headers: { Authorization: `Bearer ${otherResidentToken}` } });
    record(tIdx++, 'Non-creator resolves Query fails', r10.status === 403);

    // 11. Cross-hub resolution
    const hubBToken = ctx.tokens.tokenCross;
    let r11 = await api(`/queries/${q2.query_id}/resolve`, { method: 'POST', headers: { Authorization: `Bearer ${hubBToken}` } });
    record(tIdx++, 'Cross-hub resolution fails', r11.status === 404);

    // 12. Resolved Query is resolved again
    let r12 = await api(`/queries/${q1.query_id}/resolve`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });
    record(tIdx++, 'Resolved Query resolved again (idempotent)', r12.status === 200 && r12.body.status === 'resolved');

    // 13. Creator edits before first Answer
    let q5 = await makeQuery(residentToken);
    let r13 = await api(`/queries/${q5.query_id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${residentToken}` }, body: JSON.stringify({ title: 'Edited T', body: 'Edited B' }) });
    record(tIdx++, 'Creator edits before first Answer', r13.status === 200 && r13.body.title === 'Edited T');

    // 14. Creator edits after first Answer (fails)
    await makeAnswer(otherResidentToken, q5.query_id);
    let r14 = await api(`/queries/${q5.query_id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${residentToken}` }, body: JSON.stringify({ title: 'Edited T2', body: 'Edited B2' }) });
    record(tIdx++, 'Creator edits after first Answer fails (locked)', r14.status === 409);

    // 15. Edit after Answer soft deletion (still locked)
    let ans7 = await makeAnswer(otherResidentToken, q2.query_id);
    await api(`/queries/${q2.query_id}/answers/${ans7.answer_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${otherResidentToken}` } });
    let r15 = await api(`/queries/${q2.query_id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${residentToken}` }, body: JSON.stringify({ title: 'Edit T', body: 'Edit B' }) });
    record(tIdx++, 'Edit after Answer soft deletion (still locked)', r15.status === 409);

    // 16. Non-creator edits Query
    let q8 = await makeQuery(residentToken);
    let r16 = await api(`/queries/${q8.query_id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${otherResidentToken}` }, body: JSON.stringify({ title: 'Bad', body: 'Bad' }) });
    record(tIdx++, 'Non-creator edits Query fails', r16.status === 403);

    // 17. Concurrent edit vs first Answer
    let q9 = await makeQuery(residentToken);
    let [r17a, r17b] = await Promise.all([
      api(`/queries/${q9.query_id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${residentToken}` }, body: JSON.stringify({ title: 'Concurrent Edit', body: 'B' }) }),
      api(`/queries/${q9.query_id}/answers`, { method: 'POST', headers: { Authorization: `Bearer ${otherResidentToken}` }, body: JSON.stringify({ body: 'Concurrent Ans' }) })
    ]);
    record(tIdx++, 'Concurrent edit vs first Answer safely serialized', (r17a.status === 200 || r17a.status === 409) && r17b.status === 201);

    // 18. Creator selects Helpful Answer
    let q10 = await makeQuery(residentToken);
    let ans10 = await makeAnswer(otherResidentToken, q10.query_id);
    let r18 = await api(`/queries/${q10.query_id}/answers/${ans10.answer_id}/helpful`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });
    record(tIdx++, 'Creator selects Helpful Answer', r18.status === 200 && r18.body.is_helpful === true);

    // 19. Non-creator selects Helpful
    let r19 = await api(`/queries/${q10.query_id}/answers/${ans10.answer_id}/helpful`, { method: 'POST', headers: { Authorization: `Bearer ${otherResidentToken}` } });
    record(tIdx++, 'Non-creator selects Helpful fails', r19.status === 403);

    // 20. Helpful Answer belongs to another Query
    let q12 = await makeQuery(residentToken);
    let r20 = await api(`/queries/${q12.query_id}/answers/${ans10.answer_id}/helpful`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });
    record(tIdx++, 'Helpful Answer belongs to another Query fails', r20.status === 404);

    // 21. Two Answers marked Helpful concurrently
    let q13 = await makeQuery(residentToken);
    let ans13a = await makeAnswer(otherResidentToken, q13.query_id);
    let ans13b = await makeAnswer(otherResidentToken, q13.query_id);
    let [r21a, r21b] = await Promise.all([
      api(`/queries/${q13.query_id}/answers/${ans13a.answer_id}/helpful`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } }),
      api(`/queries/${q13.query_id}/answers/${ans13b.answer_id}/helpful`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } })
    ]);
    if (r21a.status !== 200 && r21a.status !== 422) {
      console.log(`Test 21 failed: r21a=${r21a.status}, r21b=${r21b.status}`);
    }
    record(tIdx++, 'Two Answers marked Helpful concurrently', (r21a.status === 200 && r21b.status === 422) || (r21a.status === 422 && r21b.status === 200));

    // 22. Creator changes Helpful selection
    let r22_clear = await api(`/queries/${q10.query_id}/answers/${ans10.answer_id}/helpful`, { method: 'DELETE', headers: { Authorization: `Bearer ${residentToken}` } });
    let ans14_new = await makeAnswer(residentToken, q10.query_id);
    let r22_set = await api(`/queries/${q10.query_id}/answers/${ans14_new.answer_id}/helpful`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });
    record(tIdx++, 'Creator changes Helpful selection', r22_clear.status === 204 && r22_set.status === 200);

    // 23. Marking Helpful does NOT resolve Query
    let { rows: q10Rows } = await query('SELECT status FROM neighborhood_queries WHERE query_id = $1', [q10.query_id]);
    record(tIdx++, 'Marking Helpful does NOT resolve Query', q10Rows[0].status === 'open');

    // 24. Helpful change after resolution (Rejected)
    await api(`/queries/${q10.query_id}/resolve`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });
    let r24 = await api(`/queries/${q10.query_id}/answers/${ans14_new.answer_id}/helpful`, { method: 'DELETE', headers: { Authorization: `Bearer ${residentToken}` } });
    record(tIdx++, 'Helpful change after resolution fails', r24.status === 400);

    // 25. Answer creation after resolution (Rejected)
    let r25 = await api(`/queries/${q10.query_id}/answers`, { method: 'POST', headers: { Authorization: `Bearer ${otherResidentToken}` }, body: JSON.stringify({ body: 'Late' }) });
    record(tIdx++, 'Answer creation after resolution fails', r25.status === 400);

    // 26. Helpful Answer soft-deleted
    let q18 = await makeQuery(residentToken);
    let ans18 = await makeAnswer(otherResidentToken, q18.query_id);
    await api(`/queries/${q18.query_id}/answers/${ans18.answer_id}/helpful`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });
    await api(`/queries/${q18.query_id}/answers/${ans18.answer_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${otherResidentToken}` } });
    let { rows: ans18Rows } = await query('SELECT is_helpful FROM neighborhood_query_answers WHERE answer_id = $1', [ans18.answer_id]);
    record(tIdx++, 'Helpful Answer soft-deleted clears helpful state', ans18Rows[0].is_helpful === false);

    // 27. Helpful Answer deleted after resolution
    let q19 = await makeQuery(residentToken);
    let ans19 = await makeAnswer(otherResidentToken, q19.query_id);
    await api(`/queries/${q19.query_id}/answers/${ans19.answer_id}/helpful`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });
    await api(`/queries/${q19.query_id}/resolve`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });
    await api(`/queries/${q19.query_id}/answers/${ans19.answer_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${otherResidentToken}` } });
    let { rows: ans19Rows } = await query('SELECT is_helpful FROM neighborhood_query_answers WHERE answer_id = $1', [ans19.answer_id]);
    record(tIdx++, 'Helpful Answer deleted after resolution clears helpful', ans19Rows[0].is_helpful === false);

    // 28. Deleted Answer selected as Helpful (Rejected)
    let r28 = await api(`/queries/${q19.query_id}/answers/${ans19.answer_id}/helpful`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });
    record(tIdx++, 'Deleted Answer selected as Helpful fails', r28.status === 404 || r28.status === 400);

    // --- EMERGENCY MODE TESTS ---
    console.log('--- Phase 2G-6 Emergency Mode Strict Contract ---');
    await query('TRUNCATE neighborhood_queries CASCADE');
    
    // Set up initial state before emergency mode
    const emQ = await makeQuery(residentToken);
    const emAns = await makeAnswer(otherResidentToken, emQ.query_id);
    const emHelpfulAns = await makeAnswer(otherResidentToken, emQ.query_id);
    // Mark one helpful
    await api(`/queries/${emQ.query_id}/answers/${emHelpfulAns.answer_id}/helpful`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });

    // Enable Emergency Mode on Hub A
    await query('UPDATE hubs SET emergency_mode = true WHERE hub_id = $1', [hub_id]);

    // 1. Create Query: rejected
    const emCreateQ = await api('/queries', { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` }, body: JSON.stringify({ title: 'Em', body: 'Em' }) });
    record(tIdx++, 'Emergency Mode: Create Query rejected', emCreateQ.status === 409, `Got ${emCreateQ.status}`);

    // 2. Edit Query: rejected
    const emEditQ = await api(`/queries/${emQ.query_id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${residentToken}` }, body: JSON.stringify({ title: 'New T', body: 'New B' }) });
    const { rows: emEditRows } = await query('SELECT title FROM neighborhood_queries WHERE query_id = $1', [emQ.query_id]);
    record(tIdx++, 'Emergency Mode: Edit Query rejected, unchanged', emEditQ.status === 409 && emEditRows[0].title === 'LC Title', `Got ${emEditQ.status} title ${emEditRows[0].title}`);

    // 3. Create Answer: rejected
    const emCreateA = await api(`/queries/${emQ.query_id}/answers`, { method: 'POST', headers: { Authorization: `Bearer ${otherResidentToken}` }, body: JSON.stringify({ body: 'Em Ans' }) });
    const { rows: emCreateARows } = await query('SELECT COUNT(*) as c FROM neighborhood_query_answers WHERE query_id = $1', [emQ.query_id]);
    record(tIdx++, 'Emergency Mode: Create Answer rejected, unchanged', emCreateA.status === 409 && parseInt(emCreateARows[0].c) === 2, `Got ${emCreateA.status} c ${emCreateARows[0].c}`);

    // 4. Resolve Query: rejected
    const emResolveQ = await api(`/queries/${emQ.query_id}/resolve`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });
    const { rows: emResolveRows } = await query('SELECT status FROM neighborhood_queries WHERE query_id = $1', [emQ.query_id]);
    record(tIdx++, 'Emergency Mode: Resolve Query rejected, unchanged', emResolveQ.status === 409 && emResolveRows[0].status === 'open', `Got ${emResolveQ.status} status ${emResolveRows[0].status}`);

    // 5. Set Helpful: rejected
    const emSetHelpful = await api(`/queries/${emQ.query_id}/answers/${emAns.answer_id}/helpful`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` } });
    const { rows: emSetHelpfulRows } = await query('SELECT is_helpful FROM neighborhood_query_answers WHERE answer_id = $1', [emAns.answer_id]);
    record(tIdx++, 'Emergency Mode: Set Helpful rejected, unchanged', emSetHelpful.status === 409 && emSetHelpfulRows[0].is_helpful === false, `Got ${emSetHelpful.status} is_helpful ${emSetHelpfulRows[0].is_helpful}`);

    // 6. Clear Helpful: rejected
    const emClearHelpful = await api(`/queries/${emQ.query_id}/answers/${emHelpfulAns.answer_id}/helpful`, { method: 'DELETE', headers: { Authorization: `Bearer ${residentToken}` } });
    const { rows: emClearHelpfulRows } = await query('SELECT is_helpful FROM neighborhood_query_answers WHERE answer_id = $1', [emHelpfulAns.answer_id]);
    record(tIdx++, 'Emergency Mode: Clear Helpful rejected, unchanged', emClearHelpful.status === 409 && emClearHelpfulRows[0].is_helpful === true, `Got ${emClearHelpful.status} is_helpful ${emClearHelpfulRows[0].is_helpful}`);

    // Authorization regression cases during emergency mode
    // 13. Delete another resident's Query: rejected
    const emDelOtherQ = await api(`/queries/${emQ.query_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${otherResidentToken}` } });
    const { rows: emDelOtherQRows } = await query('SELECT deleted_at FROM neighborhood_queries WHERE query_id = $1', [emQ.query_id]);
    record(tIdx++, 'Emergency Mode: Delete another resident Query rejected', emDelOtherQ.status === 403 && emDelOtherQRows[0].deleted_at === null, `Got ${emDelOtherQ.status}`);

    // 14. Delete another resident's Answer: rejected
    const emDelOtherA = await api(`/queries/${emQ.query_id}/answers/${emAns.answer_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${residentToken}` } });
    const { rows: emDelOtherARows } = await query('SELECT deleted_at FROM neighborhood_query_answers WHERE answer_id = $1', [emAns.answer_id]);
    record(tIdx++, 'Emergency Mode: Delete another resident Answer rejected', emDelOtherA.status === 403 && emDelOtherARows[0].deleted_at === null, `Got ${emDelOtherA.status}`);

    // 15. Attempt a cross-hub mutation: rejected
    const emCrossHub = await api(`/queries/${emQ.query_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${hubBToken}` } });
    record(tIdx++, 'Emergency Mode: Cross-hub mutation rejected', emCrossHub.status === 404, `Got ${emCrossHub.status}`);

    // Permitted operations
    // 11. Report Query: succeeds
    const emRepQ = await api(`/queries/${emQ.query_id}/report`, { method: 'POST', headers: { Authorization: `Bearer ${otherResidentToken}` }, body: JSON.stringify({ category: 'spam', description: 'desc' }) });
    record(tIdx++, 'Emergency Mode: Report Query succeeds', emRepQ.status === 201, `Got ${emRepQ.status}`);

    // 12. Report Answer: succeeds
    const emRepA = await api(`/queries/${emQ.query_id}/answers/${emAns.answer_id}/report`, { method: 'POST', headers: { Authorization: `Bearer ${residentToken}` }, body: JSON.stringify({ category: 'spam', description: 'desc' }) });
    record(tIdx++, 'Emergency Mode: Report Answer succeeds', emRepA.status === 201, `Got ${emRepA.status}`);

    // 8. Soft-delete own Query: succeeds
    await query('UPDATE hubs SET emergency_mode = false WHERE hub_id = $1', [hub_id]);
    const emDelQObj = await makeQuery(residentToken);
    await query('UPDATE hubs SET emergency_mode = true WHERE hub_id = $1', [hub_id]);
    const emDelQRes = await api(`/queries/${emDelQObj.query_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${residentToken}` } });
    const { rows: emDelQVerify } = await query('SELECT deleted_at FROM neighborhood_queries WHERE query_id = $1', [emDelQObj.query_id]);
    record(tIdx++, 'Emergency Mode: Soft-delete own Query succeeds', emDelQRes.status === 204 && emDelQVerify[0].deleted_at !== null, `Got ${emDelQRes.status}`);

    // 9. Soft-delete own non-Helpful Answer: succeeds
    const emDelAnsRes = await api(`/queries/${emQ.query_id}/answers/${emAns.answer_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${otherResidentToken}` } });
    const { rows: emDelAnsVerify } = await query('SELECT deleted_at FROM neighborhood_query_answers WHERE answer_id = $1', [emAns.answer_id]);
    record(tIdx++, 'Emergency Mode: Soft-delete own non-Helpful Answer succeeds', emDelAnsRes.status === 204 && emDelAnsVerify[0].deleted_at !== null, `Got ${emDelAnsRes.status}`);

    // 10. Soft-delete own Helpful Answer: succeeds
    const emDelHelpfulAnsRes = await api(`/queries/${emQ.query_id}/answers/${emHelpfulAns.answer_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${otherResidentToken}` } });
    const { rows: emDelHelpfulAnsVerify } = await query('SELECT deleted_at, is_helpful FROM neighborhood_query_answers WHERE answer_id = $1', [emHelpfulAns.answer_id]);
    record(tIdx++, 'Emergency Mode: Soft-delete own Helpful Answer succeeds', emDelHelpfulAnsRes.status === 204 && emDelHelpfulAnsVerify[0].deleted_at !== null && emDelHelpfulAnsVerify[0].is_helpful === false, `Got ${emDelHelpfulAnsRes.status} is_helpful ${emDelHelpfulAnsVerify[0].is_helpful}`);

    // Disable Emergency Mode
    await query('UPDATE hubs SET emergency_mode = false WHERE hub_id = $1', [hub_id]);

  } catch (err) {
    console.error('Test script error:', err);
  } finally {
    await cleanupTestContext(ctx);
    await stopTestServer();
    const passed = results.filter(r => r.status === 'PASS').length;
    console.log(`\nRESULTS: ${passed}/${results.length} PASS`);
    process.exit(passed === results.length ? 0 : 1);
  }
}

runTestSuite();
