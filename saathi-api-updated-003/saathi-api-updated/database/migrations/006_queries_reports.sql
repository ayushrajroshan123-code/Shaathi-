-- SAATHI — database/migrations/006_queries_reports.sql
-- Phase 2G-6 Neighborhood Queries Reports

ALTER TABLE conduct_reports DROP CONSTRAINT IF EXISTS conduct_reports_context_type_check;
ALTER TABLE conduct_reports ADD CONSTRAINT conduct_reports_context_type_check 
  CHECK (context_type IN ('coverage', 'resource', 'general', 'query', 'answer'));
