ALTER TYPE "bingo_type" ADD VALUE 'tile-race';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_race_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"bingo_id" uuid NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_team_race_jumps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"bingo_id" uuid NOT NULL,
	"jumped_from_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_team_race_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"bingo_id" uuid NOT NULL,
	"current_tile_index" integer DEFAULT 1 NOT NULL,
	"finished" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingos" ADD COLUMN "die_size" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingos" ADD COLUMN "allow_multiple_forward_jumps" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_tiles" ADD COLUMN "grid_x" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_tiles" ADD COLUMN "grid_y" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_tiles" ADD COLUMN "jump_to_index" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_race_activity_logs" ADD CONSTRAINT "bingoscape-next_race_activity_logs_team_id_bingoscape-next_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bingoscape-next_teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_race_activity_logs" ADD CONSTRAINT "bingoscape-next_race_activity_logs_bingo_id_bingoscape-next_bingos_id_fk" FOREIGN KEY ("bingo_id") REFERENCES "public"."bingoscape-next_bingos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_race_jumps" ADD CONSTRAINT "bingoscape-next_team_race_jumps_team_id_bingoscape-next_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bingoscape-next_teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_race_jumps" ADD CONSTRAINT "bingoscape-next_team_race_jumps_bingo_id_bingoscape-next_bingos_id_fk" FOREIGN KEY ("bingo_id") REFERENCES "public"."bingoscape-next_bingos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_race_states" ADD CONSTRAINT "bingoscape-next_team_race_states_team_id_bingoscape-next_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bingoscape-next_teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_race_states" ADD CONSTRAINT "bingoscape-next_team_race_states_bingo_id_bingoscape-next_bingos_id_fk" FOREIGN KEY ("bingo_id") REFERENCES "public"."bingoscape-next_bingos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_race_state_unique" ON "bingoscape-next_team_race_states" USING btree ("team_id","bingo_id");