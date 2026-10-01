const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Thin query wrapper. Every handler goes through here so we have one place
 * to add logging/metrics later without touching route code.
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run a callback inside a transaction. Used anywhere we do a read-then-write
 * that must be atomic (e.g. status transitions guarded by an authorization
 * check, or anything the DB triggers alone can't fully protect).
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
