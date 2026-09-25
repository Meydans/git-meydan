CREATE TYPE "public"."oauth_token_kind" AS ENUM('access', 'refresh');--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"redirect_uris" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"resource" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"kind" "oauth_token_kind" NOT NULL,
	"client_id" text NOT NULL,
	"resource" text NOT NULL,
	"scope" text NOT NULL,
	"secret_version" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
