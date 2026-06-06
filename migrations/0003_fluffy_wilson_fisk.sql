CREATE TYPE "public"."file_category" AS ENUM('client_photo', 'barber_document', 'medical_certificate', 'contract', 'other');--> statement-breakpoint
CREATE TYPE "public"."file_visibility" AS ENUM('admin_only', 'staff_related', 'public_profile');--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_category" "file_category" NOT NULL,
	"visibility" "file_visibility" DEFAULT 'admin_only' NOT NULL,
	"storage_bucket" varchar(100) NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_branches" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
UPDATE "user_branches"
SET "organization_id" = "users"."organization_id"
FROM "users"
WHERE "users"."id" = "user_branches"."user_id";--> statement-breakpoint
ALTER TABLE "user_branches" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "photo_file_id" uuid;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
UPDATE "appointment_services"
SET "organization_id" = "appointments"."organization_id"
FROM "appointments"
WHERE "appointments"."id" = "appointment_services"."appointment_id";--> statement-breakpoint
ALTER TABLE "appointment_services" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_settings_organization_id_idx" ON "organization_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "barber_profiles_user_id_idx" ON "barber_profiles" USING btree ("user_id");
