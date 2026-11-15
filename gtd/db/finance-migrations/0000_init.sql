CREATE SCHEMA IF NOT EXISTS "finance";
--> statement-breakpoint
CREATE TABLE "finance"."items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position" integer NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"inst" text DEFAULT '' NOT NULL,
	"liq" text DEFAULT '' NOT NULL,
	"liq_date" text DEFAULT '' NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"cur" text DEFAULT '' NOT NULL,
	"monthly" text DEFAULT '' NOT NULL,
	"updated" text DEFAULT '' NOT NULL,
	"how" text DEFAULT '' NOT NULL,
	"check" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"link" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"taken_by" text DEFAULT '' NOT NULL,
	"net" double precision NOT NULL,
	"total" double precision NOT NULL,
	"debt" double precision NOT NULL,
	"liquid" double precision NOT NULL,
	"rows" jsonb NOT NULL
);
