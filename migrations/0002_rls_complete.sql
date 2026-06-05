-- Enable RLS on all Phase 1 tables
ALTER TABLE services              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_schedules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_time_off       ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services  ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_history   ENABLE ROW LEVEL SECURITY;

-- Enable RLS on Phase 0 tables that were missing it
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branches         ENABLE ROW LEVEL SECURITY;

-- Helper: resolves the organization_id for the current auth user
-- Used inline in policies to avoid a separate function dependency

-- Policies for business tables (staff of same org can read/write)
CREATE POLICY "services_org_access" ON services
  USING (
    auth.role() = 'service_role'
    OR organization_id = (
      SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "clients_org_access" ON clients
  USING (
    auth.role() = 'service_role'
    OR organization_id = (
      SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "barber_schedules_org_access" ON barber_schedules
  USING (
    auth.role() = 'service_role'
    OR organization_id = (
      SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "barber_time_off_org_access" ON barber_time_off
  USING (
    auth.role() = 'service_role'
    OR organization_id = (
      SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "appointments_org_access" ON appointments
  USING (
    auth.role() = 'service_role'
    OR organization_id = (
      SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

-- Internal tables: deny-all for authenticated users; only service_role passes
-- appointment_services, appointment_history, audit_logs, domain_events, system_events
CREATE POLICY "appointment_services_service_role_only" ON appointment_services
  USING (auth.role() = 'service_role');

CREATE POLICY "appointment_history_service_role_only" ON appointment_history
  USING (auth.role() = 'service_role');

CREATE POLICY "audit_logs_service_role_only" ON audit_logs
  USING (auth.role() = 'service_role');

CREATE POLICY "domain_events_service_role_only" ON domain_events
  USING (auth.role() = 'service_role');

CREATE POLICY "system_events_service_role_only" ON system_events
  USING (auth.role() = 'service_role');

-- Organizations (staff reads own org)
CREATE POLICY "organizations_own" ON organizations
  USING (
    auth.role() = 'service_role'
    OR id = (
      SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "organization_settings_own" ON organization_settings
  USING (
    auth.role() = 'service_role'
    OR organization_id = (
      SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "user_branches_org_access" ON user_branches
  USING (
    auth.role() = 'service_role'
    OR user_id = (
      SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );
