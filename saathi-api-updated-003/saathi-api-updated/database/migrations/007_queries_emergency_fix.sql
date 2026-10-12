-- SAATHI — database/migrations/007_queries_emergency_fix.sql
-- Fix emergency mode trigger to allow soft-deleting a helpful answer
-- (by permitting is_helpful to be false during soft-deletion).

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
          -- The soft-deletion transition for answers requires clearing the helpful flag.
          -- Therefore, the result must be is_helpful = false.
          IF NEW.body != OLD.body OR NEW.is_helpful = TRUE THEN
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
