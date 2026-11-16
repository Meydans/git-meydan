CREATE TABLE "finance"."sim_settings" (
	"id" text PRIMARY KEY DEFAULT 'main' NOT NULL,
	"data" jsonb NOT NULL,
	"updated_by" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
