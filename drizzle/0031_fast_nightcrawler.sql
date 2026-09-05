ALTER TABLE "bingoscape-next_team_goal_progress" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "bingoscape-next_team_goal_progress" ADD COLUMN "notification_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_team_tile_submissions" ADD COLUMN "notification_sent" boolean DEFAULT false NOT NULL;