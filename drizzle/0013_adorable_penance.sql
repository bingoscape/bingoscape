DO $$ BEGIN
 CREATE TYPE "public"."skill_level" AS ENUM('beginner', 'intermediate', 'advanced', 'expert');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_player_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"ehp" real,
	"ehb" real,
	"timezone" varchar(100),
	"daily_hours_available" real,
	"skill_level" "skill_level",
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_player_metadata" ADD CONSTRAINT "bingoscape-next_player_metadata_user_id_bingoscape-next_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_player_metadata" ADD CONSTRAINT "bingoscape-next_player_metadata_event_id_bingoscape-next_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."bingoscape-next_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_metadata_user_event_unique" ON "bingoscape-next_player_metadata" USING btree ("user_id","event_id");