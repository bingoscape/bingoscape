ALTER TYPE "goal_type" ADD VALUE 'metric';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_metric_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"metric_type" varchar(50) DEFAULT 'skill' NOT NULL,
	"metric_name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bingoscape-next_metric_goals_goal_id_unique" UNIQUE("goal_id")
);
--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingos" ADD COLUMN "wom_competition_id" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingos" ADD COLUMN "wom_verification_code" varchar(255);--> statement-breakpoint
ALTER TABLE "bingoscape-next_teams" ADD COLUMN "tracker_team_name" varchar(255);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_metric_goals" ADD CONSTRAINT "bingoscape-next_metric_goals_goal_id_bingoscape-next_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."bingoscape-next_goals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
