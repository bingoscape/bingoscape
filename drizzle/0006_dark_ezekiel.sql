CREATE TABLE IF NOT EXISTS "bingoscape-next_event_donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_participant_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_event_donations" ADD CONSTRAINT "bingoscape-next_event_donations_event_participant_id_bingoscape-next_event_participants_id_fk" FOREIGN KEY ("event_participant_id") REFERENCES "public"."bingoscape-next_event_participants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
