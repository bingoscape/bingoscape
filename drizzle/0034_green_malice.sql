CREATE TABLE IF NOT EXISTS "bingoscape-next_admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text,
	"actor_label" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"target_label" text,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"outcome" text NOT NULL,
	"request_id" text,
	"ip" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_created_at_idx" ON "bingoscape-next_admin_audit_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_actor_idx" ON "bingoscape-next_admin_audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_target_idx" ON "bingoscape-next_admin_audit_log" USING btree ("target_type","target_id");