const { query, withTransaction } = require('../db');
const { ApiError } = require('../lib/errors');
const { getHubById } = require('./authorization');
const { assertUnderSubmissionCap } = require('./conduct');

/**
 * Ensures the hub exists and the query exists in the given hub.
 */
async function getQueryRecord(query_id, hub_id) {
  const { rows } = await query(
    'SELECT * FROM neighborhood_queries WHERE query_id = $1 AND hub_id = $2 AND deleted_at IS NULL',
    [query_id, hub_id]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'query not found');
  }
  return rows[0];
}

async function createQuery(hub_id, creator_id, { title, body }) {
  if (!title || title.trim().length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'title is required');
  if (!body || body.trim().length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'body is required');
  if (title.length > 120) throw new ApiError(400, 'VALIDATION_ERROR', 'title cannot exceed 120 characters');
  if (body.length > 1000) throw new ApiError(400, 'VALIDATION_ERROR', 'body cannot exceed 1000 characters');

  return withTransaction(async (client) => {
    // 1. Lock the user row to serialize submissions for this user
    await client.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE', [creator_id]);

    // 2. Check rate limit
    const { rows: limitRows } = await client.query(
      `SELECT COUNT(*)::int AS count 
       FROM neighborhood_queries 
       WHERE creator_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [creator_id]
    );
    if (limitRows[0].count >= 10) {
      throw new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Query creation limit reached (10 per 24 hours).');
    }

    // 3. Create query
    const { rows } = await client.query(
      `INSERT INTO neighborhood_queries (hub_id, creator_id, title, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [hub_id, creator_id, title.trim(), body.trim()]
    );
    
    const queryRecord = rows[0];
    
    const textToCheck = `${title} ${body}`.toLowerCase();
    const emergencyKeywords = ['fire', 'help', 'ambulance', 'emergency', 'police', 'urgent', 'danger', 'bleeding'];
    if (emergencyKeywords.some(keyword => textToCheck.includes(keyword))) {
      queryRecord._sos_nudge = true;
    }
    
    return queryRecord;
  });
}

async function listQueries(hub_id, options = {}) {
  let sql = `SELECT q.*, 
             u.name as creator_name,
             (SELECT COUNT(*) FROM neighborhood_query_answers a WHERE a.query_id = q.query_id AND a.deleted_at IS NULL) as answer_count
             FROM neighborhood_queries q
             JOIN users u ON q.creator_id = u.user_id
             WHERE q.hub_id = $1 AND q.deleted_at IS NULL`;
  const params = [hub_id];

  if (options.status) {
    sql += ` AND q.status = $2`;
    params.push(options.status);
  }

  sql += ` ORDER BY q.created_at DESC`;

  const { rows } = await query(sql, params);
  return rows;
}

async function getQueryDetails(query_id, hub_id) {
  const q = await getQueryRecord(query_id, hub_id);
  
  const { rows: creatorRows } = await query('SELECT name FROM users WHERE user_id = $1', [q.creator_id]);
  q.creator_name = creatorRows[0].name;

  return q;
}

async function updateQuery(query_id, hub_id, creator_id, { title, body }) {
  return withTransaction(async (client) => {
    // Lock the query row to prevent concurrent answer insertions from racing the edit lock
    const { rows: lockRows } = await client.query(
      'SELECT * FROM neighborhood_queries WHERE query_id = $1 AND hub_id = $2 AND deleted_at IS NULL FOR UPDATE',
      [query_id, hub_id]
    );
    if (lockRows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'query not found');
    }
    const q = lockRows[0];

    if (q.creator_id !== creator_id) {
      throw new ApiError(403, 'FORBIDDEN', 'only creator can edit query');
    }
    if (q.status !== 'open') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'cannot edit a resolved query');
    }

    const newTitle = title !== undefined ? title.trim() : q.title;
    const newBody = body !== undefined ? body.trim() : q.description;

    if (newTitle.length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'title cannot be empty');
    if (newBody.length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'body cannot be empty');
    if (newTitle.length > 120) throw new ApiError(400, 'VALIDATION_ERROR', 'title cannot exceed 120 characters');
    if (newBody.length > 1000) throw new ApiError(400, 'VALIDATION_ERROR', 'body cannot exceed 1000 characters');

    const { rows } = await client.query(
      `UPDATE neighborhood_queries 
       SET title = $1, description = $2 
       WHERE query_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [newTitle, newBody, query_id]
    );
    return rows[0];
  });
}

async function resolveQuery(query_id, hub_id, creator_id) {
  const q = await getQueryRecord(query_id, hub_id);
  if (q.creator_id !== creator_id) {
    throw new ApiError(403, 'FORBIDDEN', 'only creator can resolve query');
  }
  if (q.status === 'resolved') {
    return q; // idempotent
  }

  const { rows } = await query(
    `UPDATE neighborhood_queries SET status = 'resolved' WHERE query_id = $1 RETURNING *`,
    [query_id]
  );
  return rows[0];
}

async function deleteQuery(query_id, hub_id, creator_id) {
  const q = await getQueryRecord(query_id, hub_id);
  if (q.creator_id !== creator_id) {
    throw new ApiError(403, 'FORBIDDEN', 'only creator can delete query');
  }

  const { rows } = await query(
    `UPDATE neighborhood_queries SET deleted_at = now() WHERE query_id = $1 RETURNING *`,
    [query_id]
  );
  return rows[0];
}

async function addAnswer(query_id, hub_id, creator_id, body) {
  const q = await getQueryRecord(query_id, hub_id);
  if (q.status === 'resolved') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'cannot answer a resolved query');
  }
  
  if (!body || body.trim().length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'body is required');
  if (body.length > 1000) throw new ApiError(400, 'VALIDATION_ERROR', 'body cannot exceed 1000 characters');

  return withTransaction(async (client) => {
    // 1. Lock the user row to serialize submissions for this user
    await client.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE', [creator_id]);

    // 1b. Lock the query row FOR SHARE to serialize against concurrent edits
    await client.query('SELECT 1 FROM neighborhood_queries WHERE query_id = $1 FOR SHARE', [query_id]);

    // 2. Check rate limit
    const { rows: limitRows } = await client.query(
      `SELECT COUNT(*)::int AS count 
       FROM neighborhood_query_answers 
       WHERE creator_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [creator_id]
    );
    if (limitRows[0].count >= 20) {
      throw new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Answer creation limit reached (20 per 24 hours).');
    }

    // 3. Create answer
    const { rows } = await client.query(
      `INSERT INTO neighborhood_query_answers (query_id, creator_id, body)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [query_id, creator_id, body.trim()]
    );
    return rows[0];
  });
}

async function listAnswers(query_id, hub_id) {
  await getQueryRecord(query_id, hub_id); // ensure it exists

  const { rows } = await query(
    `SELECT a.*, u.name as creator_name 
     FROM neighborhood_query_answers a
     JOIN users u ON a.creator_id = u.user_id
     WHERE a.query_id = $1 AND a.deleted_at IS NULL
     ORDER BY a.created_at ASC`,
    [query_id]
  );
  return rows;
}

async function markAnswerHelpful(query_id, answer_id, hub_id, creator_id) {
  const q = await getQueryRecord(query_id, hub_id);
  if (q.creator_id !== creator_id) {
    throw new ApiError(403, 'FORBIDDEN', 'only query creator can select a helpful answer');
  }
  if (q.status === 'resolved') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'cannot change helpful selection on a resolved query');
  }

  // ensure answer exists and is not deleted
  const { rows: answerRows } = await query(
    'SELECT * FROM neighborhood_query_answers WHERE answer_id = $1 AND query_id = $2 AND deleted_at IS NULL',
    [answer_id, query_id]
  );
  if (answerRows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'answer not found');
  }

  return withTransaction(async (client) => {
    // Clear any existing helpful answer for this query
    await client.query(
      'UPDATE neighborhood_query_answers SET is_helpful = false WHERE query_id = $1 AND is_helpful = true',
      [query_id]
    );
    // Set the new helpful answer
    const { rows } = await client.query(
      'UPDATE neighborhood_query_answers SET is_helpful = true WHERE answer_id = $1 RETURNING *',
      [answer_id]
    );
    return rows[0];
  });
}

async function clearHelpfulAnswer(query_id, answer_id, hub_id, creator_id) {
  const q = await getQueryRecord(query_id, hub_id);
  if (q.creator_id !== creator_id) {
    throw new ApiError(403, 'FORBIDDEN', 'only query creator can clear a helpful answer');
  }
  if (q.status === 'resolved') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'cannot change helpful selection on a resolved query');
  }

  // ensure answer exists and is not deleted
  const { rows: answerRows } = await query(
    'SELECT * FROM neighborhood_query_answers WHERE answer_id = $1 AND query_id = $2 AND deleted_at IS NULL',
    [answer_id, query_id]
  );
  if (answerRows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'answer not found');
  }

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'UPDATE neighborhood_query_answers SET is_helpful = false WHERE answer_id = $1 RETURNING *',
      [answer_id]
    );
    return rows[0];
  });
}

async function deleteAnswer(query_id, answer_id, hub_id, creator_id) {
  await getQueryRecord(query_id, hub_id); // ensure query exists

  const { rows: answerRows } = await query(
    'SELECT * FROM neighborhood_query_answers WHERE answer_id = $1 AND query_id = $2 AND deleted_at IS NULL',
    [answer_id, query_id]
  );
  if (answerRows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'answer not found');
  }
  
  if (answerRows[0].creator_id !== creator_id) {
    throw new ApiError(403, 'FORBIDDEN', 'only creator can delete answer');
  }

  const { rows } = await query(
    `UPDATE neighborhood_query_answers SET deleted_at = now(), is_helpful = false WHERE answer_id = $1 RETURNING *`,
    [answer_id]
  );
  return rows[0];
}

async function reportQuery(query_id, hub_id, reporter_id, category, description) {
  const q = await getQueryRecord(query_id, hub_id);
  if (q.creator_id === reporter_id) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'cannot report yourself');
  }

  await assertUnderSubmissionCap(reporter_id);

  try {
    const { rows } = await query(
      `INSERT INTO conduct_reports (reported_by, reported_against, context_type, context_id, category, description)
       VALUES ($1, $2, 'query', $3, $4, $5)
       RETURNING *`,
      [reporter_id, q.creator_id, query_id, category, description || null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      throw new ApiError(409, 'CONFLICT', 'You have already reported this query');
    }
    throw err;
  }
}

async function reportAnswer(query_id, answer_id, hub_id, reporter_id, category, description) {
  await getQueryRecord(query_id, hub_id);
  
  const { rows: ansRows } = await query(
    'SELECT * FROM neighborhood_query_answers WHERE answer_id = $1 AND query_id = $2 AND deleted_at IS NULL',
    [answer_id, query_id]
  );
  if (ansRows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'answer not found');
  }
  const a = ansRows[0];

  if (a.creator_id === reporter_id) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'cannot report yourself');
  }

  await assertUnderSubmissionCap(reporter_id);

  try {
    const { rows } = await query(
      `INSERT INTO conduct_reports (reported_by, reported_against, context_type, context_id, category, description)
       VALUES ($1, $2, 'answer', $3, $4, $5)
       RETURNING *`,
      [reporter_id, a.creator_id, answer_id, category, description || null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw new ApiError(409, 'CONFLICT', 'You have already reported this answer');
    }
    throw err;
  }
}

module.exports = {
  createQuery,
  listQueries,
  getQueryDetails,
  updateQuery,
  resolveQuery,
  deleteQuery,
  addAnswer,
  listAnswers,
  markAnswerHelpful,
  clearHelpfulAnswer,
  deleteAnswer,
  reportQuery,
  reportAnswer
};
