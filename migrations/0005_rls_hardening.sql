DROP POLICY IF EXISTS "users_read_own" ON "users";
DROP POLICY IF EXISTS "service_role_users" ON "users";
DROP POLICY IF EXISTS "service_role_branches" ON "branches";
DROP POLICY IF EXISTS "service_role_barber_profiles" ON "barber_profiles";
DROP POLICY IF EXISTS "services_org_access" ON "services";
DROP POLICY IF EXISTS "clients_org_access" ON "clients";
DROP POLICY IF EXISTS "barber_schedules_org_access" ON "barber_schedules";
DROP POLICY IF EXISTS "barber_time_off_org_access" ON "barber_time_off";
DROP POLICY IF EXISTS "appointments_org_access" ON "appointments";
DROP POLICY IF EXISTS "appointment_services_service_role_only" ON "appointment_services";
DROP POLICY IF EXISTS "appointment_history_service_role_only" ON "appointment_history";
DROP POLICY IF EXISTS "audit_logs_service_role_only" ON "audit_logs";
DROP POLICY IF EXISTS "domain_events_service_role_only" ON "domain_events";
DROP POLICY IF EXISTS "system_events_service_role_only" ON "system_events";
DROP POLICY IF EXISTS "organizations_own" ON "organizations";
DROP POLICY IF EXISTS "organization_settings_own" ON "organization_settings";
DROP POLICY IF EXISTS "user_branches_org_access" ON "user_branches";
DROP POLICY IF EXISTS "files_admin_access" ON "files";

CREATE POLICY "users_select_self"
ON "users"
FOR SELECT
TO authenticated
USING (
  "auth_id" = (SELECT auth.uid())
  AND "status" = 'active'
  AND "deleted_at" IS NULL
);

CREATE POLICY "organizations_select_own"
ON "organizations"
FOR SELECT
TO authenticated
USING (
  "id" = (
    SELECT "organization_id"
    FROM "users"
    WHERE "auth_id" = (SELECT auth.uid())
      AND "status" = 'active'
      AND "deleted_at" IS NULL
    LIMIT 1
  )
);

CREATE POLICY "organization_settings_select_own"
ON "organization_settings"
FOR SELECT
TO authenticated
USING (
  "organization_id" = (
    SELECT "organization_id"
    FROM "users"
    WHERE "auth_id" = (SELECT auth.uid())
      AND "status" = 'active'
      AND "deleted_at" IS NULL
    LIMIT 1
  )
);

CREATE POLICY "branches_select_scoped"
ON "branches"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND actor."organization_id" = "branches"."organization_id"
      AND (
        actor."role" = 'admin'
        OR EXISTS (
          SELECT 1
          FROM "user_branches" membership
          WHERE membership."user_id" = actor."id"
            AND membership."branch_id" = "branches"."id"
        )
      )
  )
);

CREATE POLICY "services_select_own_org"
ON "services"
FOR SELECT
TO authenticated
USING (
  "organization_id" = (
    SELECT "organization_id"
    FROM "users"
    WHERE "auth_id" = (SELECT auth.uid())
      AND "status" = 'active'
      AND "deleted_at" IS NULL
    LIMIT 1
  )
);

CREATE POLICY "clients_select_own_org"
ON "clients"
FOR SELECT
TO authenticated
USING (
  "organization_id" = (
    SELECT "organization_id"
    FROM "users"
    WHERE "auth_id" = (SELECT auth.uid())
      AND "status" = 'active'
      AND "deleted_at" IS NULL
    LIMIT 1
  )
);

CREATE POLICY "clients_insert_own_org"
ON "clients"
FOR INSERT
TO authenticated
WITH CHECK (
  "organization_id" = (
    SELECT "organization_id"
    FROM "users"
    WHERE "auth_id" = (SELECT auth.uid())
      AND "status" = 'active'
      AND "deleted_at" IS NULL
    LIMIT 1
  )
);

CREATE POLICY "clients_update_own_org"
ON "clients"
FOR UPDATE
TO authenticated
USING (
  "organization_id" = (
    SELECT "organization_id"
    FROM "users"
    WHERE "auth_id" = (SELECT auth.uid())
      AND "status" = 'active'
      AND "deleted_at" IS NULL
    LIMIT 1
  )
)
WITH CHECK (
  "organization_id" = (
    SELECT "organization_id"
    FROM "users"
    WHERE "auth_id" = (SELECT auth.uid())
      AND "status" = 'active'
      AND "deleted_at" IS NULL
    LIMIT 1
  )
);

CREATE POLICY "appointments_select_scoped"
ON "appointments"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND actor."organization_id" = "appointments"."organization_id"
      AND (
        actor."role" = 'admin'
        OR (
          actor."role" = 'receptionist'
          AND EXISTS (
            SELECT 1
            FROM "user_branches" membership
            WHERE membership."user_id" = actor."id"
              AND membership."branch_id" = "appointments"."branch_id"
          )
        )
        OR (
          actor."role" = 'barber'
          AND actor."id" = "appointments"."barber_id"
        )
      )
  )
);

CREATE POLICY "appointments_insert_scoped"
ON "appointments"
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND actor."organization_id" = "appointments"."organization_id"
      AND (
        actor."role" = 'admin'
        OR (
          EXISTS (
            SELECT 1
            FROM "user_branches" membership
            WHERE membership."user_id" = actor."id"
              AND membership."branch_id" = "appointments"."branch_id"
          )
          AND (
            actor."role" = 'receptionist'
            OR (
              actor."role" = 'barber'
              AND actor."id" = "appointments"."barber_id"
            )
          )
        )
      )
  )
);

CREATE POLICY "appointments_update_scoped"
ON "appointments"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND actor."organization_id" = "appointments"."organization_id"
      AND (
        actor."role" = 'admin'
        OR (
          actor."role" = 'receptionist'
          AND EXISTS (
            SELECT 1
            FROM "user_branches" membership
            WHERE membership."user_id" = actor."id"
              AND membership."branch_id" = "appointments"."branch_id"
          )
        )
        OR (
          actor."role" = 'barber'
          AND actor."id" = "appointments"."barber_id"
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND actor."organization_id" = "appointments"."organization_id"
      AND (
        actor."role" = 'admin'
        OR (
          actor."role" = 'receptionist'
          AND EXISTS (
            SELECT 1
            FROM "user_branches" membership
            WHERE membership."user_id" = actor."id"
              AND membership."branch_id" = "appointments"."branch_id"
          )
        )
        OR (
          actor."role" = 'barber'
          AND actor."id" = "appointments"."barber_id"
        )
      )
  )
);

CREATE POLICY "barber_schedules_select_own_org"
ON "barber_schedules"
FOR SELECT
TO authenticated
USING (
  "organization_id" = (
    SELECT "organization_id"
    FROM "users"
    WHERE "auth_id" = (SELECT auth.uid())
      AND "status" = 'active'
      AND "deleted_at" IS NULL
    LIMIT 1
  )
);

CREATE POLICY "barber_time_off_select_own_org"
ON "barber_time_off"
FOR SELECT
TO authenticated
USING (
  "organization_id" = (
    SELECT "organization_id"
    FROM "users"
    WHERE "auth_id" = (SELECT auth.uid())
      AND "status" = 'active'
      AND "deleted_at" IS NULL
    LIMIT 1
  )
);

CREATE POLICY "barber_profiles_admin_only"
ON "barber_profiles"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."organization_id" = "barber_profiles"."organization_id"
      AND actor."role" = 'admin'
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."organization_id" = "barber_profiles"."organization_id"
      AND actor."role" = 'admin'
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
  )
);

CREATE POLICY "files_admin_only"
ON "files"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."organization_id" = "files"."organization_id"
      AND actor."role" = 'admin'
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."organization_id" = "files"."organization_id"
      AND actor."role" = 'admin'
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
  )
);

CREATE POLICY "user_branches_select_self"
ON "user_branches"
FOR SELECT
TO authenticated
USING (
  "user_id" = (
    SELECT "id"
    FROM "users"
    WHERE "auth_id" = (SELECT auth.uid())
      AND "status" = 'active'
      AND "deleted_at" IS NULL
    LIMIT 1
  )
);
