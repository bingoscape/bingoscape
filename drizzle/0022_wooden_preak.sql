CREATE TABLE IF NOT EXISTS "bingoscape-next_event_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"content" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_event_rules" ADD CONSTRAINT "bingoscape-next_event_rules_event_id_bingoscape-next_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."bingoscape-next_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
