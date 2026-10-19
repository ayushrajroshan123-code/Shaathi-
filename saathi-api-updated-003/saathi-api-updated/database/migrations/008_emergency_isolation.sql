-- SAATHI — database/migrations/008_emergency_isolation.sql
-- Migration 008: Emergency Hub Isolation & Single-Hub Alert Model
--
-- Formal Product Decision & Architectural Model:
-- 1. Emergency Alerts v1: Each alert targets exactly one authoritative hub
--    (hub_id UUID NOT NULL REFERENCES hubs(hub_id)). Issuer identity is stored
--    as issuer_id UUID NOT NULL REFERENCES users(user_id). affected_area is
--    descriptive metadata only. Global/multi-hub broadcasts are out of scope.
-- 2. Incident Category: Deferred. No category column, enum, or taxonomy.
-- 3. Hub Isolation: incidents, emergency_alerts, sos_events, and help_requests
--    directly store and enforce hub_id UUID NOT NULL REFERENCES hubs(hub_id).
-- 4. Fail-Closed Historical Preconditions: If historical incidents or alerts
--    exist that cannot be deterministically resolved, migration aborts.
-- 5. Deterministic Event Backfills: sos_events and help_requests backfill hub_id
--    from creator/requester hub membership before enforcing NOT NULL.

-- ===========================================================================
-- 1. TRANSACTIONAL PREFLIGHT GATES
-- ===========================================================================
DO $$
DECLARE
  v_incident_count INTEGER;
  v_alert_count INTEGER;
BEGIN
  -- Incidents currently have no creator/hub attribution column in the schema.
  -- If historical incidents exist, automated hub assignment is ambiguous.
  SELECT COUNT(*) INTO v_incident_count FROM incidents;
  IF v_incident_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION 008 PREFLIGHT FAILED: incidents table contains % row(s). Automated hub backfill is unsafe without an authorized reconciliation plan.', v_incident_count;
  END IF;

  -- Emergency alerts currently lack hub_id and issuer_id.
  -- If historical alerts exist, assigning arbitrary hubs or issuers is unsafe.
  SELECT COUNT(*) INTO v_alert_count FROM emergency_alerts;
  IF v_alert_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION 008 PREFLIGHT FAILED: emergency_alerts table contains % row(s). Alert hub/issuer backfill is unsafe without an authorized reconciliation plan.', v_alert_count;
  END IF;
END $$;

-- ===========================================================================
-- 2. SCHEMA ADDITIONS (NULLABLE INITIALLY)
-- ===========================================================================

-- 2.1 incidents
ALTER TABLE incidents
  ADD COLUMN hub_id UUID REFERENCES hubs(hub_id);

-- 2.2 emergency_alerts
ALTER TABLE emergency_alerts
  ADD COLUMN hub_id UUID REFERENCES hubs(hub_id),
  ADD COLUMN issuer_id UUID REFERENCES users(user_id);

-- 2.3 sos_events
ALTER TABLE sos_events
  ADD COLUMN hub_id UUID REFERENCES hubs(hub_id);

-- 2.4 help_requests
ALTER TABLE help_requests
  ADD COLUMN hub_id UUID REFERENCES hubs(hub_id);

-- ===========================================================================
-- 3. DETERMINISTIC HISTORICAL BACKFILLS
-- ===========================================================================

-- 3.1 Backfill sos_events from triggering user's authoritative hub
UPDATE sos_events s
SET hub_id = u.hub_id
FROM users u
WHERE s.triggered_by = u.user_id
  AND s.hub_id IS NULL;

-- 3.2 Backfill help_requests from requesting user's authoritative hub
UPDATE help_requests h
SET hub_id = u.hub_id
FROM users u
WHERE h.requested_by = u.user_id
  AND h.hub_id IS NULL;

-- ===========================================================================
-- 4. POST-BACKFILL INTEGRITY & CONSISTENCY VALIDATION
-- ===========================================================================
DO $$
DECLARE
  v_unmapped_sos INTEGER;
  v_unmapped_help INTEGER;
  v_mismatched_sos INTEGER;
  v_mismatched_help INTEGER;
  v_mismatched_helper INTEGER;
BEGIN
  -- Verify all sos_events have been assigned a hub
  SELECT COUNT(*) INTO v_unmapped_sos
  FROM sos_events
  WHERE hub_id IS NULL;
  IF v_unmapped_sos > 0 THEN
    RAISE EXCEPTION 'MIGRATION 008 BACKFILL FAILED: % sos_events row(s) could not be resolved to a hub.', v_unmapped_sos;
  END IF;

  -- Verify all help_requests have been assigned a hub
  SELECT COUNT(*) INTO v_unmapped_help
  FROM help_requests
  WHERE hub_id IS NULL;
  IF v_unmapped_help > 0 THEN
    RAISE EXCEPTION 'MIGRATION 008 BACKFILL FAILED: % help_requests row(s) could not be resolved to a hub.', v_unmapped_help;
  END IF;

  -- Validate consistency between sos_events and linked incidents (if any)
  SELECT COUNT(*) INTO v_mismatched_sos
  FROM sos_events s
  JOIN incidents i ON s.incident_id = i.incident_id
  WHERE s.hub_id <> i.hub_id;
  IF v_mismatched_sos > 0 THEN
    RAISE EXCEPTION 'MIGRATION 008 INTEGRITY FAILED: % sos_events row(s) have hub_id conflicting with parent incident.', v_mismatched_sos;
  END IF;

  -- Validate consistency between help_requests and linked incidents (if any)
  SELECT COUNT(*) INTO v_mismatched_help
  FROM help_requests h
  JOIN incidents i ON h.incident_id = i.incident_id
  WHERE h.hub_id <> i.hub_id;
  IF v_mismatched_help > 0 THEN
    RAISE EXCEPTION 'MIGRATION 008 INTEGRITY FAILED: % help_requests row(s) have hub_id conflicting with parent incident.', v_mismatched_help;
  END IF;

  -- Validate consistency between help_requests and matched helpers (if any)
  SELECT COUNT(*) INTO v_mismatched_helper
  FROM help_requests h
  JOIN users u ON h.matched_helper_id = u.user_id
  WHERE h.hub_id <> u.hub_id;
  IF v_mismatched_helper > 0 THEN
    RAISE EXCEPTION 'MIGRATION 008 INTEGRITY FAILED: % help_requests row(s) have matched_helper_id belonging to a different hub.', v_mismatched_helper;
  END IF;
END $$;

-- ===========================================================================
-- 5. CONSTRAINT HARDENING (ENFORCE NOT NULL)
-- ===========================================================================

ALTER TABLE incidents
  ALTER COLUMN hub_id SET NOT NULL;

ALTER TABLE emergency_alerts
  ALTER COLUMN hub_id SET NOT NULL,
  ALTER COLUMN issuer_id SET NOT NULL;

ALTER TABLE sos_events
  ALTER COLUMN hub_id SET NOT NULL;

ALTER TABLE help_requests
  ALTER COLUMN hub_id SET NOT NULL;

-- ===========================================================================
-- 6. SUPPORTING PERFORMANCE & REFERENTIAL INDEXES
-- ===========================================================================

CREATE INDEX idx_incidents_hub_status_created
  ON incidents(hub_id, status, created_at DESC);

CREATE INDEX idx_emergency_alerts_hub_issued
  ON emergency_alerts(hub_id, issued_at DESC);

CREATE INDEX idx_emergency_alerts_issuer_id
  ON emergency_alerts(issuer_id);

CREATE INDEX idx_sos_events_hub_timestamp
  ON sos_events(hub_id, timestamp DESC);

CREATE INDEX idx_help_requests_hub_status
  ON help_requests(hub_id, status, created_at DESC);
