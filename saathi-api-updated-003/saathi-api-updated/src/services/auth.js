const crypto = require('crypto');
const { query } = require('../db');

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) || 30;

// --- Passwords --------------------------------------------------------
// scrypt is Node's built-in, so no bcrypt/argon2 dependency is needed.
// Stored as "salt:hash", both hex-encoded.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- Sessions --------------------------------------------------------------
// Opaque bearer tokens, not JWTs: the raw token is returned to the client
// exactly once at creation and never persisted; only its SHA-256 hash is
// stored, so a session can be looked up and individually revoked (logout,
// coordinator-suspends-account) without needing a JWT blocklist.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [userId, hashToken(token), SESSION_TTL_DAYS]
  );
  return token;
}

async function loadActorFromToken(token) {
  const { rows } = await query(
    `SELECT s.session_id, s.expires_at, s.revoked_at,
            u.user_id, u.role, u.is_active, u.account_status
     FROM sessions s
     JOIN users u ON u.user_id = s.user_id
     WHERE s.token_hash = $1`,
    [hashToken(token)]
  );
  const row = rows[0];
  if (!row) return null;
  if (row.revoked_at || new Date(row.expires_at) < new Date()) return null;
  if (!row.is_active || row.account_status !== 'active') return null;
  return { user_id: row.user_id, role: row.role, session_id: row.session_id };
}

async function revokeSession(sessionId) {
  await query('UPDATE sessions SET revoked_at = now() WHERE session_id = $1', [sessionId]);
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  loadActorFromToken,
  revokeSession,
};
