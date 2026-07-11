CREATE OR REPLACE FUNCTION blakcert_prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events
FOR EACH ROW EXECUTE FUNCTION blakcert_prevent_audit_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION blakcert_prevent_audit_mutation();
--> statement-breakpoint
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE certificate_deployments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE certificate_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY certificates_tenant_isolation ON certificates
  USING (organisation_id = NULLIF(current_setting('blakcert.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = NULLIF(current_setting('blakcert.organisation_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY certificate_deployments_tenant_isolation ON certificate_deployments
  USING (organisation_id = NULLIF(current_setting('blakcert.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = NULLIF(current_setting('blakcert.organisation_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY certificate_requests_tenant_isolation ON certificate_requests
  USING (organisation_id = NULLIF(current_setting('blakcert.organisation_id', true), '')::uuid)
  WITH CHECK (organisation_id = NULLIF(current_setting('blakcert.organisation_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY audit_events_tenant_isolation ON audit_events
  USING (organisation_id = NULLIF(current_setting('blakcert.organisation_id', true), '')::uuid OR organisation_id IS NULL)
  WITH CHECK (organisation_id = NULLIF(current_setting('blakcert.organisation_id', true), '')::uuid OR organisation_id IS NULL);
--> statement-breakpoint
CREATE POLICY background_jobs_tenant_isolation ON background_jobs
  USING (organisation_id = NULLIF(current_setting('blakcert.organisation_id', true), '')::uuid OR organisation_id IS NULL)
  WITH CHECK (organisation_id = NULLIF(current_setting('blakcert.organisation_id', true), '')::uuid OR organisation_id IS NULL);
