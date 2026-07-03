ALTER TABLE "bingoscape-next_bingos" ADD COLUMN "wom_competition_id" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingos" ADD COLUMN "wom_verification_code" varchar(255);--> statement-breakpoint
ALTER TABLE "bingoscape-next_events" DROP COLUMN IF EXISTS "tracker_competition_id";--> statement-breakpoint
ALTER TABLE "bingoscape-next_events" DROP COLUMN IF EXISTS "tracker_provider";--> statement-breakpoint
ALTER TABLE "bingoscape-next_metric_goals" DROP COLUMN IF EXISTS "tracker_provider";