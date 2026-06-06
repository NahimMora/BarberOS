REVOKE ALL ON TABLE
  "users",
  "organizations",
  "organization_settings",
  "branches",
  "services",
  "clients",
  "appointments",
  "barber_schedules",
  "barber_time_off",
  "barber_profiles",
  "files",
  "user_branches"
FROM anon;

GRANT SELECT ON TABLE
  "users",
  "organizations",
  "organization_settings",
  "branches",
  "services",
  "clients",
  "appointments",
  "barber_schedules",
  "barber_time_off",
  "barber_profiles",
  "files",
  "user_branches"
TO authenticated;

GRANT INSERT, UPDATE ON TABLE
  "clients",
  "appointments",
  "barber_profiles",
  "files"
TO authenticated;
