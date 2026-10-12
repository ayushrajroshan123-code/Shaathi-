-- SAATHI — database/migrations/005_queries_v1.sql
-- Phase 2G-6 Neighborhood Queries v1

-- 1. Add emergency_mode to hubs
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS emergency_mode BOOLEAN NOT NULL DEFAULT false;

-- 2. Modify neighborhood_queries
ALTER TABLE neighborhood_queries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE neighborhood_queries ALTER COLUMN category DROP NOT NULL;
ALTER TABLE neighborhood_queries DROP CONSTRAINT IF EXISTS neighborhood_queries_category_check;

ALTER TABLE neighborhood_queries DROP CONSTRAINT IF EXISTS neighborhood_queries_status_check;
ALTER TABLE neighborhood_queries ADD CONSTRAINT neighborhood_queries_status_check CHECK (status IN ('open', 'resolved'));

ALTER TABLE neighborhood_queries ADD CONSTRAINT neighborhood_queries_title_len CHECK (char_length(title) <= 120);
ALTER TABLE neighborhood_queries ADD CONSTRAINT neighborhood_queries_body_len CHECK (char_length(description) <= 1000);

-- 3. Create neighborhood_query_answers
CREATE TABLE neighborhood_query_answers (
  answer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES neighborhood_queries(query_id),
  creator_id UUID NOT NULL REFERENCES users(user_id),
  body TEXT NOT NULL,
  is_helpful BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT answer_body_len CHECK (char_length(body) <= 1000)
);

CREATE INDEX idx_query_answers_query ON neighborhood_query_answers(query_id);
CREATE UNIQUE INDEX idx_query_answers_helpful 
ON neighborhood_query_answers(query_id) 
WHERE is_helpful = true AND deleted_at IS NULL;

-- 4. Triggers to enforce emergency mode atomically on both queries and answers.
CREATE OR REPLACE FUNCTION trg_enforce_emergency_mode_queries()
RETURNS TRIGGER AS $$
DECLARE
  v_hub_id UUID;
  v_emergency_mode BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'neighborhood_queries' THEN
    IF TG_OP = 'INSERT' THEN
      v_hub_id := NEW.hub_id;
    ELSE
      v_hub_id := OLD.hub_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'neighborhood_query_answers' THEN
    IF TG_OP = 'INSERT' THEN
      SELECT hub_id INTO v_hub_id FROM neighborhood_queries WHERE query_id = NEW.query_id;
    ELSE
      SELECT hub_id INTO v_hub_id FROM neighborhood_queries WHERE query_id = OLD.query_id;
    END IF;
  END IF;

  SELECT emergency_mode INTO v_emergency_mode FROM hubs WHERE hub_id = v_hub_id;
  
  IF v_emergency_mode = TRUE THEN
    IF TG_OP = 'UPDATE' THEN
      -- Allow soft-deletion exception during emergency mode
      IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        -- Ensure other fields are not modified
        IF TG_TABLE_NAME = 'neighborhood_queries' THEN
          IF NEW.title != OLD.title OR NEW.description != OLD.description OR NEW.status != OLD.status THEN
            RAISE EXCEPTION 'EMERGENCY_MODE_ACTIVE: modifications blocked during emergency mode';
          END IF;
        ELSIF TG_TABLE_NAME = 'neighborhood_query_answers' THEN
          IF NEW.body != OLD.body OR NEW.is_helpful != OLD.is_helpful THEN
            RAISE EXCEPTION 'EMERGENCY_MODE_ACTIVE: modifications blocked during emergency mode';
          END IF;
        END IF;
        RETURN NEW;
      END IF;
    END IF;
    
    RAISE EXCEPTION 'EMERGENCY_MODE_ACTIVE: action blocked during emergency mode';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_emergency_queries
BEFORE INSERT OR UPDATE ON neighborhood_queries
FOR EACH ROW EXECUTE FUNCTION trg_enforce_emergency_mode_queries();

CREATE TRIGGER trg_check_emergency_answers
BEFORE INSERT OR UPDATE ON neighborhood_query_answers
FOR EACH ROW EXECUTE FUNCTION trg_enforce_emergency_mode_queries();

-- 5. Trigger to enforce query edit lock on neighborhood_queries
CREATE OR REPLACE FUNCTION trg_enforce_query_edit_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_answer_exists BOOLEAN;
BEGIN
  IF NEW.title != OLD.title OR NEW.description != OLD.description THEN
    SELECT EXISTS(
      SELECT 1 FROM neighborhood_query_answers WHERE query_id = NEW.query_id
    ) INTO v_answer_exists;
    
    IF v_answer_exists THEN
      RAISE EXCEPTION 'QUERY_LOCKED: cannot edit query after an answer has been submitted';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_query_edit_lock
BEFORE UPDATE ON neighborhood_queries
FOR EACH ROW EXECUTE FUNCTION trg_enforce_query_edit_lock();

-- 6. Unique constraint for reports on conduct_reports
CREATE UNIQUE INDEX IF NOT EXISTS idx_conduct_reports_unique_report 
ON conduct_reports(reported_by, context_type, context_id);
