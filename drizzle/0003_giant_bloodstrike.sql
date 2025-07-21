DO $$ BEGIN
 CREATE TYPE "public"."bingo_type" AS ENUM('standard', 'progression');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_team_tier_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"bingo_id" uuid NOT NULL,
	"tier" integer NOT NULL,
	"is_unlocked" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingos" ADD COLUMN "bingo_type" "bingo_type" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingos" ADD COLUMN "tiers_unlock_requirement" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_tiles" ADD COLUMN "tier" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_tier_progress" ADD CONSTRAINT "bingoscape-next_team_tier_progress_team_id_bingoscape-next_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bingoscape-next_teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_tier_progress" ADD CONSTRAINT "bingoscape-next_team_tier_progress_bingo_id_bingoscape-next_bingos_id_fk" FOREIGN KEY ("bingo_id") REFERENCES "public"."bingoscape-next_bingos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_bingo_tier_unique" ON "bingoscape-next_team_tier_progress" USING btree ("team_id","bingo_id","tier");