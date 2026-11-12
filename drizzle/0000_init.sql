CREATE TYPE "public"."request_status" AS ENUM('success', 'error', 'aborted');--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"model" text NOT NULL,
	"prompt" text NOT NULL,
	"response" text DEFAULT '' NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"cost_usd" double precision,
	"latency_ms" integer NOT NULL,
	"status" "request_status" NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "requests_session_created_idx" ON "requests" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "requests_model_idx" ON "requests" USING btree ("model");