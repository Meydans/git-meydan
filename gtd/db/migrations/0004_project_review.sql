ALTER TYPE "public"."project_status" ADD VALUE 'dropped';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "review_cadence_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "stall_acknowledged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_review_cadence_range" CHECK ("projects"."review_cadence_days" between 1 and 365);