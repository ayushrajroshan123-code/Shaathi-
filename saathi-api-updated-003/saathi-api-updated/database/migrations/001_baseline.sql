-- SAATHI — database/migrations/001_baseline.sql
-- Executable migration wrapper for the frozen canonical schema.
--
-- This file's SQL body is byte-identical to database/schema.sql at the
-- moment schema.sql was declared FROZEN. schema.sql remains the canonical,
-- human-reviewed artifact; this file is what the migration runner
-- (scripts/migrate.js) actually applies and checksums, so "frozen" is
-- enforced mechanically, not just by convention: scripts/migrate.js refuses
-- to re-apply this file if its checksum ever drifts from what's recorded in
-- schema_migrations, and scripts/verify-schema.js separately confirms the
-- live database matches database/expected-schema.json, which was generated
-- from this same frozen body.
--
-- Do not hand-edit this file to fix a schema problem. If schema.sql needs to
-- change, that is a new architectural decision: update schema.sql, then add
-- a new numbered migration (002_*, 003_*, ...) that ALTERs the live schema
-- to match — the same amend-by-superseding discipline API_CONTRACT.md uses.
--
-- ===========================================================================

-- SAATHI — Pilot Database Schema
-- Canonical PostgreSQL persistence artifact
-- Status: FROZEN for Phase 1 pilot implementation
--
-- IMPORTANT PROCESS RULE
-- Every newly accepted architectural decision must appear in a canonical
-- checked-in artifact before implementation proceeds.
--
-- This file is the source of truth for database structure and DB-enforceable
-- invariants. Service-level authorization and workflow rules are documented
-- here as comments and must also exist in the API contract.
--
-- Database: PostgreSQL
-- Required extension: pgcrypto
--
-- ---------------------------------------------------------------------------
-- COVERAGE STATE MACHINE + AUTHORIZATION CONTRACT
-- ---------------------------------------------------------------------------
--
-- Coverage lifecycle:
--
--   REQUESTED
--     |\
--     | \ cancel (requester)
--     |  -> CANCELLED
--     |
--     +--> ACCEPTED (eligible assigned volunteer)
--     |\
--     | \ cancel (requester or assigned volunteer, subject to API
--     |    cancellation policy)
--     |  -> CANCELLED
--     |
--     +--> IN_PROGRESS (assigned volunteer)
--            |
--            +--> handoff created/updated when property access
--            |     is involved
--            |
--            +--> handoff confirmation:
--            |       requester_confirmed = TRUE
--            |       AND
--            |       volunteer_confirmed = TRUE
--            |
--            +--> COMPLETED
--                   only when:
--                   - no access handoff is required, OR
--                   - the access handoff is fully confirmed
--
-- COMPLETED and CANCELLED are terminal states for normal user actions.
--
-- Action authorization:
--   create           -> requester
--   accept           -> eligible assigned volunteer
--   start            -> assigned volunteer
--   cancel           -> requester or assigned volunteer, subject to API policy
--   handoff          -> authorized coverage participants
--   handoff/confirm  -> respective requester/volunteer confirmation
--   complete         -> assigned volunteer, subject to completion preconditions
--   administrative resolution
--                    -> coordinator
--
-- The API MUST enforce actor authorization. Database triggers below enforce
-- critical state/data invariants that are practical to enforce in PostgreSQL.
--
-- ---------------------------------------------------------------------------
-- ELIGIBILITY / PRIVACY CONTRACT
-- ---------------------------------------------------------------------------
--
-- Eligibility is an operational result, not a public trust label.
--
-- GET /users/{user_id}/eligibility?task_type=...
--   - self: allowed
--   - coordinator: allowed
--   - ordinary resident querying another user: denied
--
-- Response exposes only the minimum useful fact:
--   { "task_type": "...", "eligible": true|false }
--
-- Verification method, tier, expiry, notes, and review details are not exposed
-- through the ordinary eligibility endpoint.
--
-- ---------------------------------------------------------------------------
-- CONDUCT REPORT ABUSE CONTROLS — FROZEN NUMBERS
-- ---------------------------------------------------------------------------
--
-- These are explicit pilot numbers, not placeholders:
--
-- 1. A reporter may submit at most 10 ConductReports in a rolling 24-hour
--    period. The 11th submission is rejected by the service layer.
--
-- 2. If the same reporter reports the same target 3 or more times in a
--    rolling 30-day period, the newest report is marked
--    repeat_pattern_flag = TRUE and requires coordinator attention.
--
-- 3. The repeated-report flag does NOT automatically reject the report and
--    does NOT automatically suspend/remove the target.
--
-- 4. A coordinator remains responsible for reviewing and deciding conduct
--    action.
--
-- The service layer should enforce the hard 10/24h submission limit because
-- it is a rolling-window operational policy. The repeat-pattern flag is
-- persisted with the report so the governance signal cannot disappear.
--
-- ---------------------------------------------------------------------------
-- PHASE BOUNDARIES
-- ---------------------------------------------------------------------------
--
-- Phase 1 launch_allowed = TRUE:
--   package_collection
--   plant_watering
--   pet_feeding
--   pet_walking
--
-- Phase 1 launch_allowed = FALSE:
--   domestic_help_backup
--   child_pickup
--   child_supervision
--   elderly_care
--   dependent_adult_care
--   medical_caregiving
--
-- Emergency functionality is represented in the schema for later phases but
-- is not exposed by the Phase 1 API.
--
-- ---------------------------------------------------------------------------
-- CREDENTIAL STORAGE INVARIANT
-- ---------------------------------------------------------------------------
--
-- AccessHandoff stores only access_type and lifecycle/confirmation metadata.
-- Actual keys, door codes, PINs, passwords, or other credentials are NEVER
-- persisted in this database.
--
-- ---------------------------------------------------------------------------
-- RESOURCES CONFIRMATION MODEL (decided)
-- ---------------------------------------------------------------------------
--
-- Resources intentionally does NOT use Coverage-style dual confirmation as
-- a completion gate. Coverage's gate exists because property-access
-- credentials create a security boundary that must be provably closed
-- before completion; a borrowed drill or wheelchair carries no equivalent
-- credential risk, so status transitions (HANDED_OFF, RETURNED) are
-- single-party, owner-controlled, and unblocked.
--
-- However, Conduct exists precisely to arbitrate disputes ("it was never
-- returned" / "it came back broken"), and arbitration needs both parties'
-- account on record, not just the owner's. So the requester's attestation
-- is captured alongside the owner's status changes as a non-blocking
-- record only -- it never gates a transition, it only gives a future
-- ConductReport review something to weigh against the owner's version.
--
-- The owner is always the actor for HANDED_OFF/RETURNED; there is no
-- separate "delivery actor" concept in this schema. handoff_method
-- (pickup | delivery) describes logistics only, not a distinct actor.
--
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===========================================================================
-- 1. CORE HUB GRAPH
-- ===========================================================================

CREATE TABLE hubs (
  hub_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('RWA', 'college', 'apartment')),
  roster_source TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  user_id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id                    UUID NOT NULL REFERENCES hubs(hub_id),
  name                      TEXT NOT NULL,
  role                      TEXT NOT NULL CHECK (
                              role IN ('resident', 'verified_helper', 'coordinator')
                            ),
  contact_preferences       JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_endpoints    JSONB NOT NULL DEFAULT '{}'::jsonb,
  emergency_contact_user_id UUID REFERENCES users(user_id),
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 2. TRUST / VERIFICATION
-- ===========================================================================

CREATE TABLE verification_records (
  record_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id),
  method      TEXT NOT NULL CHECK (
                method IN ('hub_roster', 'manual_review')
              ),
  verified_by UUID NOT NULL REFERENCES users(user_id),
  tier        TEXT NOT NULL CHECK (
                tier IN ('standard', 'helper', 'restricted')
              ),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  notes       TEXT
);

-- ===========================================================================
-- 3. COVERAGE TAXONOMY
-- ===========================================================================

CREATE TABLE task_taxonomy (
  task_type                  TEXT PRIMARY KEY,
  risk_level                 TEXT NOT NULL CHECK (
                                risk_level IN ('low', 'high', 'restricted')
                              ),
  required_verification_tier TEXT NOT NULL CHECK (
                                required_verification_tier IN ('standard', 'helper', 'restricted')
                              ),
  launch_allowed              BOOLEAN NOT NULL
);

-- ===========================================================================
-- 4. COVERAGE REQUESTS
-- ===========================================================================

CREATE TABLE coverage_requests (
  request_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type          TEXT NOT NULL
                        REFERENCES task_taxonomy(task_type),
  requested_by       UUID NOT NULL REFERENCES users(user_id),
  assigned_to        UUID REFERENCES users(user_id),
  date               DATE NOT NULL,
  time_window_start  TIMESTAMPTZ NOT NULL,
  time_window_end    TIMESTAMPTZ NOT NULL,
  location           TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (
                        status IN (
                          'REQUESTED',
                          'ACCEPTED',
                          'IN_PROGRESS',
                          'COMPLETED',
                          'CANCELLED',
                          'EXPIRED'
                        )
                      ),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ,
  CHECK (time_window_end > time_window_start),
  -- The explicit date is the calendar date represented by the start of the
  -- coverage window in the pilot's operational timezone (India, all hubs).
  -- PostgreSQL stores the authoritative instant in time_window_start; this
  -- CHECK pins the redundant `date` column to the same local calendar day
  -- a resident would actually type in, so a 2 AM IST booking doesn't
  -- silently disagree with the date field (which a naive UTC conversion
  -- would push to the previous day).
  CHECK (date = (time_window_start AT TIME ZONE 'Asia/Kolkata')::date)
);

-- ===========================================================================
-- 5. PROPERTY ACCESS HANDOFF
-- ===========================================================================

CREATE TABLE access_handoffs (
  handoff_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coverage_request_id   UUID NOT NULL UNIQUE
                           REFERENCES coverage_requests(request_id),
  access_type           TEXT NOT NULL CHECK (
                           access_type IN (
                             'key',
                             'door_code',
                             'supervised_entry',
                             'none'
                           )
                         ),
  provided_at           TIMESTAMPTZ,
  returned_at           TIMESTAMPTZ,
  requester_confirmed   BOOLEAN NOT NULL DEFAULT FALSE,
  volunteer_confirmed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    returned_at IS NULL
    OR provided_at IS NOT NULL
  ),
  CHECK (
    access_type IN ('key', 'door_code')
    OR returned_at IS NULL
    OR provided_at IS NOT NULL
  )
);

-- ===========================================================================
-- 6. RESOURCES
-- ===========================================================================

CREATE TABLE resource_inventory (
  resource_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                    UUID NOT NULL REFERENCES users(user_id),
  type                        TEXT NOT NULL CHECK (
                                 type IN (
                                   'wheelchair',
                                   'drill',
                                   'ladder',
                                   'bicycle',
                                   'power_bank',
                                   'first_aid_kit',
                                   'tools',
                                   'books'
                                 )
                               ),
  condition                   TEXT NOT NULL,
  availability_window_start   TIMESTAMPTZ,
  availability_window_end     TIMESTAMPTZ,
  emergency_opt_in            BOOLEAN NOT NULL DEFAULT FALSE,
  location                    TEXT NOT NULL,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    availability_window_end IS NULL
    OR availability_window_start IS NOT NULL
  ),
  CHECK (
    availability_window_start IS NULL
    OR availability_window_end > availability_window_start
  )
);

CREATE TABLE resource_requests (
  request_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id                   UUID NOT NULL
                                   REFERENCES resource_inventory(resource_id),
  requested_by                  UUID NOT NULL REFERENCES users(user_id),
  time_window_start             TIMESTAMPTZ NOT NULL,
  time_window_end               TIMESTAMPTZ NOT NULL,
  status                        TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (
                                   status IN (
                                     'REQUESTED',
                                     'ACCEPTED',
                                     'HANDED_OFF',
                                     'RETURNED',
                                     'CANCELLED',
                                     'EXPIRED'
                                   )
                                 ),
  handoff_method                TEXT NOT NULL CHECK (
                                   handoff_method IN ('pickup', 'delivery')
                                 ),
  -- Non-blocking requester attestations. These never gate a status
  -- transition (owner alone controls status); they exist only so a
  -- future ConductReport review has both parties' account of what
  -- happened, not just the owner's.
  requester_confirmed_handoff   BOOLEAN NOT NULL DEFAULT FALSE,
  requester_confirmed_return    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (time_window_end > time_window_start)
);

-- ===========================================================================
-- 7. CONDUCT / TRUST SAFETY
-- ===========================================================================

CREATE TABLE conduct_reports (
  report_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by         UUID NOT NULL REFERENCES users(user_id),
  reported_against    UUID NOT NULL REFERENCES users(user_id),
  context_type        TEXT NOT NULL CHECK (
                         context_type IN (
                           'coverage',
                           'resource',
                           'general'
                         )
                       ),
  context_id          UUID,
  category             TEXT NOT NULL,
  description          TEXT,
  evidence             JSONB NOT NULL DEFAULT '[]'::jsonb,
  status               TEXT NOT NULL DEFAULT 'reported' CHECK (
                          status IN (
                            'reported',
                            'under_review',
                            'resolved'
                          )
                        ),
  coordinator_id       UUID REFERENCES users(user_id),
  action_taken         TEXT CHECK (
                          action_taken IN (
                            'no_action',
                            'warning',
                            'temporary_suspension',
                            'permanent_removal'
                          )
                        ),
  repeat_pattern_flag  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at          TIMESTAMPTZ,
  CHECK (
    context_type = 'general'
    OR context_id IS NOT NULL
  ),
  CHECK (
    reported_by <> reported_against
  )
);

-- ===========================================================================
-- 8. EMERGENCY HELP
-- ===========================================================================

CREATE TABLE help_requests (
  request_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       UUID NOT NULL,
  requested_by      UUID NOT NULL REFERENCES users(user_id),
  need_type         TEXT NOT NULL,
  urgency           TEXT NOT NULL CHECK (
                       urgency IN ('critical', 'high', 'medium', 'low')
                     ),
  location          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (
                       status IN (
                         'REQUESTED',
                         'MATCHED',
                         'IN_PROGRESS',
                         'RESOLVED',
                         'CANCELLED'
                       )
                     ),
  matched_helper_id UUID REFERENCES users(user_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);

-- ===========================================================================
-- 9. EMERGENCY INCIDENT
-- ===========================================================================

CREATE TABLE incidents (
  incident_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source            TEXT NOT NULL CHECK (
                       source IN (
                         'SOS',
                         'alert',
                         'hazard_report'
                       )
                     ),
  priority_score    NUMERIC(8,2),
  priority_level    TEXT CHECK (
                       priority_level IN (
                         'critical',
                         'high',
                         'medium',
                         'low'
                       )
                     ),
  status            TEXT NOT NULL DEFAULT 'OPEN' CHECK (
                       status IN (
                         'OPEN',
                         'PRIORITIZED',
                         'COORDINATING',
                         'RESOLVED'
                       )
                     ),
  location          TEXT NOT NULL,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  affected_people   INTEGER NOT NULL DEFAULT 0,
  vulnerable_people TEXT NOT NULL DEFAULT 'none' CHECK (
                       vulnerable_people IN (
                         'elderly',
                         'child',
                         'injured',
                         'none'
                       )
                     ),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  CHECK (affected_people >= 0),
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR
    (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  )
);

ALTER TABLE help_requests
  ADD CONSTRAINT fk_help_requests_incident
  FOREIGN KEY (incident_id)
  REFERENCES incidents(incident_id);

CREATE TABLE incident_helpers (
  incident_id  UUID NOT NULL REFERENCES incidents(incident_id),
  user_id      UUID NOT NULL REFERENCES users(user_id),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (incident_id, user_id)
);

CREATE TABLE incident_resources (
  incident_id  UUID NOT NULL
                 REFERENCES incidents(incident_id),
  resource_id  UUID NOT NULL
                 REFERENCES resource_inventory(resource_id),
  deployed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (incident_id, resource_id)
);

-- ===========================================================================
-- 10. EMERGENCY SOS
-- ===========================================================================

CREATE TABLE sos_events (
  sos_id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by                      UUID NOT NULL REFERENCES users(user_id),
  incident_id                       UUID REFERENCES incidents(incident_id),
  location                          TEXT NOT NULL,
  latitude                          DOUBLE PRECISION,
  longitude                         DOUBLE PRECISION,
  battery_level                     INTEGER CHECK (
                                       battery_level BETWEEN 0 AND 100
                                     ),
  timestamp                         TIMESTAMPTZ NOT NULL DEFAULT now(),
  accidental_protection_confirmed   BOOLEAN NOT NULL DEFAULT FALSE,
  offline_stored                    BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR
    (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  )
);

-- ===========================================================================
-- 11. EMERGENCY ALERTS
-- ===========================================================================

CREATE TABLE emergency_alerts (
  alert_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level          TEXT NOT NULL CHECK (
                    level IN ('watch', 'warning', 'emergency')
                  ),
  source         TEXT NOT NULL CHECK (
                    source IN ('coordinator', 'system')
                  ),
  affected_area  TEXT NOT NULL,
  issued_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 12. NOTIFICATIONS
-- ===========================================================================

CREATE TABLE notifications (
  notification_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id     UUID NOT NULL REFERENCES users(user_id),
  type             TEXT NOT NULL CHECK (
                      type IN (
                        'SOS',
                        'help_accepted',
                        'im_safe',
                        'check_in'
                      )
                    ),
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at          TIMESTAMPTZ
);

-- ===========================================================================
-- 13. PRIORITY OVERRIDE AUDIT
-- ===========================================================================

CREATE TABLE priority_overrides (
  override_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id      UUID NOT NULL
                      REFERENCES incidents(incident_id),
  coordinator_id   UUID NOT NULL
                      REFERENCES users(user_id),
  previous_score   NUMERIC(8,2),
  new_score        NUMERIC(8,2),
  previous_level   TEXT,
  new_level        TEXT NOT NULL CHECK (
                      new_level IN (
                        'critical',
                        'high',
                        'medium',
                        'low'
                      )
                    ),
  reason           TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 14. EMERGENCY CATEGORY ROUTING CONTRACT
-- ===========================================================================
--
-- Normal:
--   water_leak
--   power_outage
--   blocked_corridor
--   broken_streetlight
--   noise_complaint
--   other
--
-- Emergency:
--   flood_entry
--   fire
--   structural_damage
--   blocked_road
--   gas_leak
--   other_hazard
--
-- category -> workflow
-- status   -> lifecycle
--
-- A misclassified report may be manually reclassified to an incident by a
-- coordinator. Automatic category escalation is NOT part of Phase 3.
--
-- The Phase 3 IssueReport table/lifecycle remains intentionally absent until
-- the competing IssueReport state-machine definitions are reconciled and one
-- final lifecycle is frozen.

-- ===========================================================================
-- 15. INDEXES
-- ===========================================================================

CREATE INDEX idx_users_hub_id
  ON users(hub_id);

CREATE INDEX idx_verification_records_user_id
  ON verification_records(user_id);

CREATE INDEX idx_verification_records_active_window
  ON verification_records(user_id, tier, expires_at);

CREATE INDEX idx_coverage_requests_hub_lookup
  ON coverage_requests(requested_by, status, time_window_start);

CREATE INDEX idx_coverage_requests_assigned
  ON coverage_requests(assigned_to, status, time_window_start);

CREATE INDEX idx_access_handoffs_coverage_request
  ON access_handoffs(coverage_request_id);

CREATE INDEX idx_resource_inventory_owner
  ON resource_inventory(owner_id, is_active);

CREATE INDEX idx_resource_requests_resource
  ON resource_requests(resource_id, status);

CREATE INDEX idx_conduct_reports_reporter_target_time
  ON conduct_reports(reported_by, reported_against, created_at);

CREATE INDEX idx_conduct_reports_target_time
  ON conduct_reports(reported_against, created_at);

CREATE INDEX idx_conduct_reports_status
  ON conduct_reports(status);

CREATE INDEX idx_incidents_status_priority
  ON incidents(status, priority_level, created_at);

CREATE INDEX idx_help_requests_incident
  ON help_requests(incident_id, status);

CREATE INDEX idx_sos_events_incident
  ON sos_events(incident_id);

CREATE INDEX idx_notifications_recipient
  ON notifications(recipient_id, sent_at);

-- ===========================================================================
-- 16. DB-LEVEL ENFORCEMENT FUNCTIONS / TRIGGERS
-- ===========================================================================
--
-- These enforce high-value invariants at the database boundary as defense in
-- depth. The API MUST still perform the same checks and return clean API
-- errors; the database is not a substitute for authorization.
--
-- ---------------------------------------------------------------------------
-- 16.1 Phase-1 launch boundary
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_coverage_task_launch_allowed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  allowed BOOLEAN;
BEGIN
  SELECT launch_allowed
    INTO allowed
    FROM task_taxonomy
   WHERE task_type = NEW.task_type;

  IF NOT COALESCE(allowed, FALSE) THEN
    RAISE EXCEPTION
      'TASK_NOT_AVAILABLE: task type % is not enabled for the current pilot',
      NEW.task_type
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coverage_task_launch_allowed
  BEFORE INSERT OR UPDATE OF task_type
  ON coverage_requests
  FOR EACH ROW
  EXECUTE FUNCTION enforce_coverage_task_launch_allowed();

-- ---------------------------------------------------------------------------
-- 16.2 Coverage completion requires access-handoff confirmation when needed
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_coverage_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  handoff_required   BOOLEAN;
  handoff_confirmed  BOOLEAN;
BEGIN
  IF NEW.status = 'COMPLETED'
     AND OLD.status IS DISTINCT FROM 'COMPLETED' THEN

    SELECT EXISTS (
      SELECT 1
        FROM access_handoffs ah
       WHERE ah.coverage_request_id = NEW.request_id
         AND ah.access_type <> 'none'
    )
    INTO handoff_required;

    IF handoff_required THEN
      SELECT (
        requester_confirmed = TRUE
        AND volunteer_confirmed = TRUE
      )
      INTO handoff_confirmed
      FROM access_handoffs
      WHERE coverage_request_id = NEW.request_id;

      IF NOT COALESCE(handoff_confirmed, FALSE) THEN
        RAISE EXCEPTION
          'ACCESS_HANDOFF_NOT_CONFIRMED: both requester and volunteer must confirm before coverage can be completed'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coverage_completion
  BEFORE UPDATE OF status
  ON coverage_requests
  FOR EACH ROW
  EXECUTE FUNCTION enforce_coverage_completion();

-- ---------------------------------------------------------------------------
-- 16.3 Conduct repeat-pattern flag
--
-- Exact frozen rule:
--   >= 3 reports by the same reporter against the same target
--   within the preceding 30 days => flag current report.
--
-- This does not reject the report and does not trigger disciplinary action.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION mark_conduct_repeat_pattern()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prior_count INTEGER;
BEGIN
  SELECT COUNT(*)
    INTO prior_count
    FROM conduct_reports
   WHERE reported_by = NEW.reported_by
     AND reported_against = NEW.reported_against
     AND created_at >= now() - INTERVAL '30 days'
     AND created_at < NEW.created_at;

  NEW.repeat_pattern_flag := (prior_count >= 2);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_conduct_repeat_pattern
  BEFORE INSERT
  ON conduct_reports
  FOR EACH ROW
  EXECUTE FUNCTION mark_conduct_repeat_pattern();

-- ===========================================================================
-- 17. SEED DATA — PHASE 1 TASK TAXONOMY
-- ===========================================================================
--
-- This section is safe to run against a fresh database. The production
-- migration/seed runner should use the equivalent idempotent seed operation.
--

INSERT INTO task_taxonomy
  (task_type, risk_level, required_verification_tier, launch_allowed)
VALUES
  ('package_collection',   'low',        'standard',   TRUE),
  ('plant_watering',       'low',        'standard',   TRUE),
  ('pet_feeding',          'low',        'standard',   TRUE),
  ('pet_walking',          'low',        'standard',   TRUE),
  ('domestic_help_backup', 'high',       'helper',     FALSE),
  ('child_pickup',         'restricted', 'restricted', FALSE),
  ('child_supervision',    'restricted', 'restricted', FALSE),
  ('elderly_care',         'restricted', 'restricted', FALSE),
  ('dependent_adult_care', 'restricted', 'restricted', FALSE),
  ('medical_caregiving',   'restricted', 'restricted', FALSE)
ON CONFLICT (task_type) DO UPDATE
SET
  risk_level = EXCLUDED.risk_level,
  required_verification_tier = EXCLUDED.required_verification_tier,
  launch_allowed = EXCLUDED.launch_allowed;

-- ===========================================================================
-- END OF CANONICAL SCHEMA
-- ===========================================================================
