# SAATHI API (Phase 1 pilot)

Express + PostgreSQL API implementing `database/schema.sql` (frozen).

## Setup

```bash
npm install
cp .env.example .env   # set DATABASE_URL to an empty database
npm run migrate        # applies database/migrations/*.sql in order
npm run verify-schema  # confirms the live DB matches database/expected-schema.json
npm start
```

`npm run db:setup` runs the migrate + verify-schema pair in one step. See
`database/README.txt` for how the migration runner enforces "frozen" and
how to add a new migration later. `database/schema.sql` remains the
canonical, human-reviewed record of the schema; `database/migrations/`
is what's actually executed and tracked against the database.

## Auth

Real session auth — see `database/migrations/002_auth.sql`,
`src/services/auth.js`, `src/routes/auth.js`, and API_CONTRACT.md
decision #7.1 (supersedes #7). This replaces the earlier `x-user-id`
pilot stub entirely; every route now requires
`Authorization: Bearer <token>` from a token issued by
`POST /auth/login`. The API still loads the actor's role from the DB on
every request rather than trusting anything in the request body.

**Email + password only:** `POST /auth/signup` or `POST /auth/login`
with `{email, password}` (plus `hub_id, name` on signup). The phone +
OTP path from decision #7 has been removed — see #7.1 for why and what
to do if phone-based signup is needed later.

New self-signups always start as `role: 'resident'`,
`account_status: 'pending_approval'` and cannot log in until a
coordinator calls `PATCH /users/:id/approve` (see `GET /users/pending`
for the review queue). Coordinator-created users (`POST /users` —
roster import / manual pilot setup) default to `account_status: 'active'`
immediately, since the coordinator creating the row is itself the
vouching step.

`POST /auth/logout` revokes only the calling session, not every session
the user has open elsewhere.

**Open decisions, not yet frozen** (see API_CONTRACT.md decision #7,
carried forward by #7.1): email/password signups have no
confirmation-link verification step; there's no login
rate-limiting/lockout on the password path.

## Endpoints

**Auth**
- `POST /auth/signup` — `{hub_id, name, email, password}`
- `POST /auth/login` — `{email, password}`
- `POST /auth/logout`

**Users / verification**
- `POST /users` (coordinator)
- `GET /users/pending` (coordinator — self-signups awaiting approval)
- `PATCH /users/:id/approve` | `/reject` (coordinator)
- `GET /users/:id`
- `GET /users/:id/eligibility?task_type=...` (self or coordinator only — 404 otherwise)
- `POST /users/:id/verification-records` (coordinator)
- `GET /users/:id/verification-records` (self or coordinator only)

**Coverage**
- `POST /coverage-requests`
- `GET /coverage-requests`, `GET /coverage-requests/:id`
- `POST /coverage-requests/:id/accept` | `/start` | `/cancel` | `/complete`
- `POST /coverage-requests/:id/handoff` | `/handoff/confirm`

**Resources**
- `POST /resources`, `GET /resources`
- `POST /resources/requests`, `GET /resources/requests/:id`
- `POST /resources/requests/:id/accept` | `/handoff` | `/handoff/confirm` | `/return` | `/return/confirm` | `/cancel`

**Conduct**
- `POST /conduct-reports`
- `GET /conduct-reports` | `/:id` (coordinator)
- `PATCH /conduct-reports/:id` (coordinator)

**Emergency** (see phase-boundary note below)
- `POST /incidents`, `GET /incidents` | `/:id`, `PATCH /incidents/:id` (coordinator)
- `POST /incidents/:id/helpers` | `/resources`
- `POST /help-requests`, `POST /help-requests/:id/match`, `PATCH /help-requests/:id`
- `POST /sos-events`
- `POST /emergency-alerts` (coordinator)
- `GET /notifications`

## Phase boundary — emergency routes

The schema's own comments say: *"Emergency functionality is represented in
the schema for later phases but is not exposed by the Phase 1 API."*
`src/routes/emergency.js` is implemented in full (per this build request),
but it's now gated behind `ENABLE_EMERGENCY_ROUTES=true` in `src/app.js` —
off by default, so a Phase 1 deploy doesn't expose it unless that env var
is explicitly set.

## Frozen decisions surfaced in the code (API_CONTRACT.md)

These are exactly the items flagged in the schema review. The code implements the specific choices that are now frozen in `API_CONTRACT.md`:

1. **Resource/coverage expiration** (`src/services/coverage.js`,
   `effectiveStatus`) — a `REQUESTED`/`ACCEPTED`
   request is treated as `EXPIRED` once `time_window_end` has passed,
   computed at read time. No `expires_at` column added.

2. **Eligibility tier comparison** (`src/services/eligibility.js`,
   `isEligible`) — requires an **exact** match between an active
   verification tier and the task's `required_verification_tier`. Does
   **not** assume a `helper > standard > restricted` hierarchy.

3. **Resource overlap** — not enforced anywhere. Two accepted/handed-off
   requests can currently have overlapping time windows for the same
   resource. No exclusion constraint has been added to the schema.

4. **Volunteer role** — enforced only as a comment
   (`src/services/coverage.js`) and via `assigned_to`/route logic; never
   introduced as a fourth `users.role` value.

5. **Coverage cancellation authorization** — implemented exactly per the
   frozen table (`CANCEL_AUTH` in `src/services/coverage.js`).

## Fixed after review

- **Undefined-param crashes**: several optional-field inserts passed JS
  `undefined` straight to node-postgres, which throws instead of binding
  `NULL` — so `COALESCE($n, default)` in SQL never got a chance to apply.
  Fixed in `conduct.js` (evidence), `users.js` (contact_preferences,
  notification_endpoints), `resources.js` (emergency_opt_in), and
  `emergency.js` (affected_people, vulnerable_people,
  accidental_protection_confirmed, offline_stored).
- **Inconsistent error mapping**: `dbErrorToApiError` (constraint/trigger
  violations → clean 422s) was only used in `coverage.js`/`resources.js`.
  Moved into `middleware/context.js` as a shared export and applied
  everywhere so no router falls through to a bare 500.
- **Read authorization gaps**: `GET /users/:userId` now returns the full
  row only to self/coordinator — anyone else gets `{user_id, name, role}`
  only, never `contact_preferences`/`notification_endpoints`/
  `emergency_contact_user_id`. `GET /coverage-requests/:id` and
  `GET /resources/requests/:id` now 404 (not reveal-then-403) for any
  non-participant, non-coordinator actor, matching the pattern the
  eligibility endpoint already used.
- Note: reads are still not scoped by `hub_id`. In a multi-hub deployment
  this means the *authorization* per-row is correct (only participants can
  read a given row), but there's no hub-level filtering on list endpoints.
  Low risk with UUIDs as the only enumeration vector, but worth adding if
  multi-hub isolation becomes a real requirement.

## What the database already enforces (not duplicated here)

- Phase-1 task launch boundary (trigger `enforce_coverage_task_launch_allowed`)
- Coverage completion requires access-handoff confirmation when required (trigger `enforce_coverage_completion`)
- Conduct repeat-pattern flag, >=3 reports/30 days (trigger `mark_conduct_repeat_pattern`)
- The 10-reports/24h submission cap is service-layer only per the schema's own comment — implemented in `src/services/conduct.js`.
