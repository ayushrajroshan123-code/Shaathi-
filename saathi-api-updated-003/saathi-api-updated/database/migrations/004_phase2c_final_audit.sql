-- SAATHI — database/migrations/004_phase2c_final_audit.sql
-- Phase 2C Final Audit Corrections.
--
-- Applied on top of 001_baseline.sql, 002_auth.sql, and 003_coordination.sql.
-- Canonical specification: API_CONTRACT.md (Frozen Phase 2B).
--
-- This migration corrects two domain-integrity issues identified in the
-- Phase 2C Final Audit:
--
-- CORRECTION 1 — handoff_policy column default
--   The default value 'Community pickup at Cafe Courtyard' embedded an
--   inappropriate physical-location assumption derived from the 3D demo
--   coordination point. Cafe Courtyard is a named diorama element used in
--   demo narratives; it is NOT a universal backend production constant.
--
--   The domain contract (API_CONTRACT.md §2.2 and §7.2) states:
--     "Safe, mutually agreed handoff arrangement (e.g., at a community
--      coordination point such as the Community Exchange or another
--      appropriate neutral public location)."
--
--   The corrected default is 'Safe/mutually agreed handoff', which is
--   policy-neutral, leaves the specific arrangement to the owner/borrower,
--   and does not encode any physical location into the domain schema.
--
--   Impact: zero resource_inventory rows exist at correction time.
--   No data migration is required; only the column default changes.
--
-- CORRECTION 2 — requester identity consistency constraint
--   resource_requests currently carries two fields for the same semantic
--   concept (the authenticated member who requested the resource):
--     • requested_by  — historical pilot field (retained for backward compatibility)
--     • requester_id  — canonical Phase 2B domain field
--
--   A bidirectional synchronisation trigger (trg_sync_resource_requests_requester)
--   was introduced in migration 003 to keep the fields in sync. However, it only
--   handles the case where exactly ONE of the two fields is NULL. If an UPDATE
--   sets BOTH to non-NULL values simultaneously (e.g. a bug in legacy runtime
--   code), neither branch fires and the fields can diverge silently.
--
--   This correction adds a CHECK constraint that enforces: when both fields are
--   non-NULL they MUST be identical. This eliminates any possibility of silent
--   divergence while preserving full backward compatibility with the sync trigger.
--
--   Impact: zero resource_requests rows exist at correction time.
--   No data migration is required.
--
-- AUDIT 3 FINDING — counterpart_id / resource ownership (NO SCHEMA CHANGE)
--   The coordinations.counterpart_id column is correctly documented in this
--   migration as a service-layer invariant, not a database constraint:
--
--   INVARIANT (service layer, Phase 2D):
--     For resource coordinations (type = 'resource'), the service that creates
--     the coordination upon owner approval of a resource request MUST set:
--       coordinations.counterpart_id = resource_inventory.owner_id
--     where resource_inventory is joined via the approved resource_request.
--
--   WHY NOT A DB TRIGGER:
--     The constraint spans two entities (coordinations + resource_inventory)
--     and varies by type ('resource' vs 'coverage'). A trigger would require
--     a cross-table lookup and would need to distinguish coordination type.
--     The information is already fully available at the service layer: the
--     approval flow reads resource_inventory.owner_id before creating the
--     coordination. A service-enforced invariant is cleaner and less fragile
--     than a trigger for this case.
--
--   Phase 2D is responsible for enforcing this invariant in the coordination
--   creation service (POST /resources/requests/:id/approve flow).
--
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- CORRECTION 1: Remove the 3D-demo location assumption from handoff_policy default
-- ---------------------------------------------------------------------------

ALTER TABLE resource_inventory
  ALTER COLUMN handoff_policy SET DEFAULT 'Safe/mutually agreed handoff';

-- ---------------------------------------------------------------------------
-- CORRECTION 2: Requester identity consistency constraint
-- Prevents silent divergence between canonical requester_id and legacy requested_by
-- when both are non-NULL on the same row.
-- ---------------------------------------------------------------------------

ALTER TABLE resource_requests
  DROP CONSTRAINT IF EXISTS chk_resource_requests_requester_consistency;

ALTER TABLE resource_requests
  ADD CONSTRAINT chk_resource_requests_requester_consistency CHECK (
    requester_id IS NULL
    OR requested_by IS NULL
    OR requester_id = requested_by
  );

-- ===========================================================================
-- END OF MIGRATION 004
-- ===========================================================================
