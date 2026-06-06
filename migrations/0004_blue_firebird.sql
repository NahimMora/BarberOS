ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointment_id_service_id_pk" PRIMARY KEY("appointment_id","service_id");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_photo_file_id_files_id_fk" FOREIGN KEY ("photo_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_organization_entity_idx" ON "files" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_storage_path_idx" ON "files" USING btree ("storage_bucket","storage_path");--> statement-breakpoint

ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "files_admin_access"
ON "files"
FOR ALL
TO authenticated
USING (
  "organization_id" = (
    SELECT "organization_id"
    FROM "users"
    WHERE "auth_id" = (SELECT auth.uid())
      AND "role" = 'admin'
      AND "status" = 'active'
    LIMIT 1
  )
)
WITH CHECK (
  "organization_id" = (
    SELECT "organization_id"
    FROM "users"
    WHERE "auth_id" = (SELECT auth.uid())
      AND "role" = 'admin'
      AND "status" = 'active'
    LIMIT 1
  )
);--> statement-breakpoint

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'barberos-private',
  'barberos-private',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
