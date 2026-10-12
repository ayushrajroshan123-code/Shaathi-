-- SAATHI — database/migrations/002_auth.sql
-- Additive migration: real authentication, replacing the x-user-id pilot
-- stub described in README.md's former "Auth (pilot-only stub)" section.
--
-- Applied on top of the frozen database/schema.sql. Does not redefine or
-- narrow any existing column's meaning — only adds nullable/defaulted
-- columns to `users` and one new table. See API_CONTRACT.md decision #7.1
-- (email + password only; supersedes #7's original phone+OTP-or-email
-- design — self-signup + coordinator approval is unchanged).
--
-- Run after schema.sql:
--   psql "$DATABASE_URL" -f database/schema.sql
--   psql "$DATABASE_URL" -f database/migrations/002_auth.sql

-- ---------------------------------------------------------------------------
-- USERS: credentials, account lifecycle
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN email TEXT UNIQUE,
  ADD COLUMN password_hash TEXT,
  ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active' CHECK (
    account_status IN ('pending_approval', 'active', 'rejected', 'suspended')
  ),
  ADD COLUMN approved_by UUID REFERENCES users(user_id),
  ADD COLUMN approved_at TIMESTAMPTZ;

-- account_status defaults to 'active' at the column level so existing
-- coordinator-created rows (POST /users — roster import, manual pilot
-- setup) are unaffected. Self-signup (POST /auth/signup) explicitly
-- inserts 'pending_approval' instead of relying on this default.
COMMENT ON COLUMN users.account_status IS
  'pending_approval: self-signed-up via POST /auth/signup, awaiting coordinator review (PATCH /users/:id/approve|reject). '
  'active: normal usable account — the default, so coordinator-created rows need no explicit value. '
  'rejected / suspended: cannot authenticate. Distinct from is_active, which is a separate deactivation switch '
  '(is_active predates this migration and already gates the old x-user-id stub and every DB read via loadActor).';

-- A password only makes sense paired with an email login.
ALTER TABLE users
  ADD CONSTRAINT chk_users_password_requires_email
  CHECK (password_hash IS NULL OR email IS NOT NULL);

-- NOTE: this CHECK is satisfied trivially by any pre-existing row (both
-- columns are nullable, so NULL/NULL passes) — no backfill concern here,
-- unlike a NOT NULL contact-method requirement would have.

-- ---------------------------------------------------------------------------
-- SESSIONS
-- ---------------------------------------------------------------------------
-- Only token_hash (SHA-256 of the opaque bearer token) is stored. The raw
-- token is returned to the client exactly once, at creation
-- (POST /auth/login), and never persisted or logged.
CREATE TABLE sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- ===========================================================================
-- END OF MIGRATION 002
-- ===========================================================================
