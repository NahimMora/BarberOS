-- Custom SQL migration file, put your code below! --

-- RLS aditiva para la APP de clientes (self-service). No reemplaza ninguna
-- policy de staff existente — Postgres OR's todas las policies permisivas
-- del mismo comando, así que esto solo agrega un camino de acceso nuevo,
-- scoped por `clients.auth_user_id = auth.uid()` en vez de `users.auth_id`.
-- Sigue el mismo patrón que migrations/0005_rls_hardening.sql.

ALTER TABLE "client_visit_photos" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "client_visit_photos" FROM anon;
GRANT SELECT ON TABLE "client_visit_photos" TO authenticated;

-- clients: el propio cliente puede ver/actualizar su fila. La restricción
-- fina de qué columnas puede tocar (nunca notes/extra_profile/tags, que son
-- internos del staff) vive en el endpoint (zod), igual que el resto del
-- sistema — mismo nivel de garantía que ya tienen las policies de staff.
CREATE POLICY "clients_select_self"
ON "clients"
FOR SELECT
TO authenticated
USING (
  "auth_user_id" = (SELECT auth.uid())
);

CREATE POLICY "clients_update_self"
ON "clients"
FOR UPDATE
TO authenticated
USING (
  "auth_user_id" = (SELECT auth.uid())
)
WITH CHECK (
  "auth_user_id" = (SELECT auth.uid())
);

-- appointments: el cliente ve/crea/cancela solo los suyos.
CREATE POLICY "appointments_select_self"
ON "appointments"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "clients" c
    WHERE c."auth_user_id" = (SELECT auth.uid())
      AND c."id" = "appointments"."client_id"
  )
);

CREATE POLICY "appointments_insert_self"
ON "appointments"
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "clients" c
    WHERE c."auth_user_id" = (SELECT auth.uid())
      AND c."id" = "appointments"."client_id"
      AND c."id" = "appointments"."created_by_client_id"
  )
);

CREATE POLICY "appointments_update_self"
ON "appointments"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "clients" c
    WHERE c."auth_user_id" = (SELECT auth.uid())
      AND c."id" = "appointments"."client_id"
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "clients" c
    WHERE c."auth_user_id" = (SELECT auth.uid())
      AND c."id" = "appointments"."client_id"
  )
);

-- files: el cliente solo ve archivos explícitamente marcados
-- 'client_visible' y asociados a su propio client_id.
CREATE POLICY "files_select_client_visible_self"
ON "files"
FOR SELECT
TO authenticated
USING (
  "visibility" = 'client_visible'
  AND "entity_type" = 'client'
  AND EXISTS (
    SELECT 1 FROM "clients" c
    WHERE c."auth_user_id" = (SELECT auth.uid())
      AND c."id" = "files"."entity_id"
  )
);

-- client_visit_photos: staff del mismo org (backstop, las subidas reales
-- pasan por el backend con la conexión de servicio) + el cliente dueño.
CREATE POLICY "client_visit_photos_staff_org_access"
ON "client_visit_photos"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND actor."organization_id" = "client_visit_photos"."organization_id"
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND actor."organization_id" = "client_visit_photos"."organization_id"
  )
);

CREATE POLICY "client_visit_photos_select_self"
ON "client_visit_photos"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "clients" c
    WHERE c."auth_user_id" = (SELECT auth.uid())
      AND c."id" = "client_visit_photos"."client_id"
  )
);
