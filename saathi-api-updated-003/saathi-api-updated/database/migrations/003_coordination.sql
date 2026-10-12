-- SAATHI — database/migrations/003_coordination.sql
-- Additive migration: Phase 2C Coordination domain model, lifecycle state machines,
-- two-party return tracking, member safety blocking, and community issues/queries.
--
-- Applied on top of 001_baseline.sql and 002_auth.sql.
-- Canonical specification: API_CONTRACT.md (Frozen Phase 2B).
--
-- Entities introduced / modified:
--   1. resource_inventory (expanded taxonomy, public general_area, handoff policy, hub scope)
--   2. resource_requests (reconciled lifecycle, purpose/duration, requester integrity trigger)
--   3. coordinations (first-class operational fulfillment entity)
--   4. coordination_events (immutable operational audit log)
--   5. coordination_messages (contextual operational notes)
--   6. blocked_users (mutual safety boundary with self-block prevention)
--   7. neighborhood_issues (public infrastructure reporting with 3D diorama coords)
--   8. neighborhood_queries (shared community demand aggregation)

-- ---------------------------------------------------------------------------
-- 1. RESOURCE INVENTORY EXPANSION
-- ---------------------------------------------------------------------------

ALTER TABLE resource_inventory
  ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(hub_id),
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS general_area TEXT,
  ADD COLUMN IF NOT EXISTS handoff_policy TEXT NOT NULL DEFAULT 'Community pickup at Cafe Courtyard',
  ADD COLUMN IF NOT EXISTS allowed_requesters TEXT NOT NULL DEFAULT 'Verified neighborhood members',
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT TRUE;

-- Update resource_inventory type check constraint to include canonical Phase 2 taxonomy
-- while preserving full backwards compatibility with legacy pilot types.
ALTER TABLE resource_inventory DROP CONSTRAINT IF EXISTS resource_inventory_type_check;
ALTER TABLE resource_inventory ADD CONSTRAINT resource_inventory_type_check CHECK (
  type IN (
    -- Canonical Phase 2 taxonomy (API_CONTRACT.md Section 9.2):
    'tools', 'electrical', 'medical', 'transport', 'gardening',
    'emergency', 'mobility', 'energy', 'inspection',
    -- Legacy pilot types preserved for backwards compatibility:
    'wheelchair', 'drill', 'ladder', 'bicycle', 'power_bank',
    'first_aid_kit', 'books'
  )
);

CREATE INDEX IF NOT EXISTS idx_resource_inventory_hub_id
  ON resource_inventory(hub_id);

-- ---------------------------------------------------------------------------
-- 2. RESOURCE REQUESTS MODIFICATIONS
-- ---------------------------------------------------------------------------

ALTER TABLE resource_requests
  ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS duration TEXT,
  ADD COLUMN IF NOT EXISTS handoff_preference TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Synchronize requester_id and requested_by for seamless backward compatibility
CREATE OR REPLACE FUNCTION sync_resource_requests_requester()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.requester_id IS NULL AND NEW.requested_by IS NOT NULL THEN
    NEW.requester_id := NEW.requested_by;
  ELSIF NEW.requested_by IS NULL AND NEW.requester_id IS NOT NULL THEN
    NEW.requested_by := NEW.requester_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_resource_requests_requester ON resource_requests;
CREATE TRIGGER trg_sync_resource_requests_requester
  BEFORE INSERT OR UPDATE ON resource_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_resource_requests_requester();

-- Backfill requester_id for any existing rows where requested_by is set
UPDATE resource_requests
   SET requester_id = requested_by
 WHERE requester_id IS NULL AND requested_by IS NOT NULL;

-- Allow either requester_id or requested_by to satisfy requester presence
ALTER TABLE resource_requests ALTER COLUMN requested_by DROP NOT NULL;
ALTER TABLE resource_requests DROP CONSTRAINT IF EXISTS chk_resource_requests_has_requester;
ALTER TABLE resource_requests ADD CONSTRAINT chk_resource_requests_has_requester
  CHECK (requester_id IS NOT NULL OR requested_by IS NOT NULL);

-- Legacy handoff_method is superseded by handoff_preference; make nullable with default
ALTER TABLE resource_requests ALTER COLUMN handoff_method DROP NOT NULL;
ALTER TABLE resource_requests ALTER COLUMN handoff_method SET DEFAULT 'pickup';

-- Update status check constraint: canonical Phase 2 Resource Request lifecycle
-- REQUESTED -> APPROVED | DECLINED | BLOCKED | CANCELLED | EXPIRED
-- (Legacy ACCEPTED is migrated to APPROVED; operational HANDED_OFF/RETURNED now live on coordinations)
UPDATE resource_requests SET status = 'APPROVED' WHERE status = 'ACCEPTED';

ALTER TABLE resource_requests DROP CONSTRAINT IF EXISTS resource_requests_status_check;
ALTER TABLE resource_requests ADD CONSTRAINT resource_requests_status_check CHECK (
  status IN ('REQUESTED', 'APPROVED', 'DECLINED', 'BLOCKED', 'CANCELLED', 'EXPIRED')
);

-- Defense-in-depth: Member cannot request their own resource
CREATE OR REPLACE FUNCTION enforce_resource_request_not_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner_id UUID;
  v_requester UUID;
BEGIN
  v_requester := COALESCE(NEW.requester_id, NEW.requested_by);
  SELECT owner_id INTO v_owner_id
    FROM resource_inventory
   WHERE resource_id = NEW.resource_id;

  IF v_owner_id IS NOT NULL AND v_owner_id = v_requester THEN
    RAISE EXCEPTION
      'OWN_RESOURCE_REQUEST_FORBIDDEN: A member cannot request their own resource'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resource_request_not_owner ON resource_requests;
CREATE TRIGGER trg_resource_request_not_owner
  BEFORE INSERT OR UPDATE OF resource_id, requester_id, requested_by
  ON resource_requests
  FOR EACH ROW
  EXECUTE FUNCTION enforce_resource_request_not_owner();

CREATE INDEX IF NOT EXISTS idx_resource_requests_requester
  ON resource_requests(requester_id, status);

-- ---------------------------------------------------------------------------
-- 3. COORDINATIONS (FIRST-CLASS ENTITY)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS coordinations (
  coordination_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id                    UUID NOT NULL REFERENCES hubs(hub_id),
  request_id                UUID REFERENCES resource_requests(request_id),
  coverage_request_id       UUID REFERENCES coverage_requests(request_id),
  resource_id               UUID REFERENCES resource_inventory(resource_id),
  requester_id              UUID NOT NULL REFERENCES users(user_id),
  counterpart_id            UUID NOT NULL REFERENCES users(user_id),
  title                     TEXT NOT NULL,
  type                      TEXT NOT NULL CHECK (type IN ('resource', 'coverage')),
  state                     TEXT NOT NULL CHECK (
                              state IN (
                                'APPROVED',
                                'SCHEDULED',
                                'HANDOFF_READY',
                                'HANDED_OVER',
                                'IN_USE',
                                'RETURN_DUE',
                                'RETURN_PENDING',
                                'COMPLETED',
                                'DECLINED',
                                'BLOCKED',
                                'CANCELLED',
                                'EXPIRED'
                              )
                            ),
  purpose                   TEXT,
  handoff_location          TEXT,
  scheduled_time            TIMESTAMPTZ,
  due_time                  TIMESTAMPTZ,
  borrower_return_initiated BOOLEAN NOT NULL DEFAULT FALSE,
  owner_return_confirmed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at              TIMESTAMPTZ,
  CONSTRAINT chk_coordination_distinct_participants CHECK (requester_id <> counterpart_id),
  CONSTRAINT chk_coordination_time_window CHECK (due_time IS NULL OR scheduled_time IS NULL OR due_time >= scheduled_time)
);

CREATE INDEX IF NOT EXISTS idx_coordinations_requester_state
  ON coordinations(requester_id, state);

CREATE INDEX IF NOT EXISTS idx_coordinations_counterpart_state
  ON coordinations(counterpart_id, state);

CREATE INDEX IF NOT EXISTS idx_coordinations_resource
  ON coordinations(resource_id);

CREATE INDEX IF NOT EXISTS idx_coordinations_request
  ON coordinations(request_id);

CREATE INDEX IF NOT EXISTS idx_coordinations_hub
  ON coordinations(hub_id);

-- ---------------------------------------------------------------------------
-- 4. COORDINATION EVENTS (AUDIT HISTORY)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS coordination_events (
  event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_id UUID NOT NULL REFERENCES coordinations(coordination_id),
  event_type      TEXT NOT NULL CHECK (
                    event_type IN (
                      'COORDINATION_CREATED',
                      'SCHEDULED',
                      'HANDOFF_READY',
                      'HANDED_OVER',
                      'IN_USE',
                      'RETURN_DUE',
                      'RETURN_INITIATED',
                      'RETURN_CONFIRMED',
                      'COMPLETED',
                      'CANCELLED',
                      'MEMBER_BLOCKED',
                      'SAFETY_REPORT_CREATED'
                    )
                  ),
  actor_id        UUID NOT NULL REFERENCES users(user_id),
  summary         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event immutability enforcement: audit records are append-only
CREATE OR REPLACE FUNCTION prevent_coordination_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'COORDINATION_EVENT_IMMUTABLE: Coordination events cannot be modified or deleted'
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_coordination_events_immutable ON coordination_events;
CREATE TRIGGER trg_coordination_events_immutable
  BEFORE UPDATE OR DELETE ON coordination_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_coordination_event_mutation();

CREATE INDEX IF NOT EXISTS idx_coordination_events_coordination_time
  ON coordination_events(coordination_id, created_at);

-- ---------------------------------------------------------------------------
-- 5. COORDINATION MESSAGES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS coordination_messages (
  message_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_id UUID NOT NULL REFERENCES coordinations(coordination_id),
  sender_id       UUID NOT NULL REFERENCES users(user_id),
  text            TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 5000),
  message_type    TEXT NOT NULL CHECK (
                    message_type IN (
                      'pre_approval_inquiry',
                      'coordination_note',
                      'system_notice'
                    )
                  ),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coordination_messages_coordination_time
  ON coordination_messages(coordination_id, created_at);

-- ---------------------------------------------------------------------------
-- 6. BLOCKED USERS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS blocked_users (
  blocker_id      UUID NOT NULL REFERENCES users(user_id),
  blocked_user_id UUID NOT NULL REFERENCES users(user_id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_user_id),
  CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked
  ON blocked_users(blocked_user_id);

-- ---------------------------------------------------------------------------
-- 7. NEIGHBORHOOD ISSUES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS neighborhood_issues (
  issue_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id           UUID NOT NULL REFERENCES hubs(hub_id),
  title            TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (
                     category IN ('infrastructure', 'safety', 'gardening', 'cleanliness')
                   ),
  severity         TEXT NOT NULL CHECK (
                     severity IN ('low', 'medium', 'high')
                   ),
  general_location TEXT NOT NULL,
  reported_by      UUID NOT NULL REFERENCES users(user_id),
  status           TEXT NOT NULL DEFAULT 'reported' CHECK (
                     status IN ('reported', 'attention_needed', 'in_progress', 'parts_ordered', 'resolved')
                   ),
  detail           TEXT,
  position_3d      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_neighborhood_issues_hub_status
  ON neighborhood_issues(hub_id, status);

-- ---------------------------------------------------------------------------
-- 8. NEIGHBORHOOD QUERIES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS neighborhood_queries (
  query_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id           UUID NOT NULL REFERENCES hubs(hub_id),
  creator_id       UUID NOT NULL REFERENCES users(user_id),
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (
                     category IN ('home_service', 'group_order', 'bulk_delivery')
                   ),
  preferred_timing TEXT,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (
                     status IN ('open', 'coordinating', 'completed')
                   ),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_neighborhood_queries_hub_status
  ON neighborhood_queries(hub_id, status);

-- ===========================================================================
-- END OF MIGRATION 003
-- ===========================================================================
