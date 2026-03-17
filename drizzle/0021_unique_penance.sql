DO $$ BEGIN
 CREATE TYPE "public"."game_type" AS ENUM('osrs', 'rs3');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "bingoscape-next_events" ADD COLUMN "game_type" "game_type" DEFAULT 'osrs' NOT NULL;