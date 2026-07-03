ALTER TABLE "bingoscape-next_metric_goals" ADD COLUMN "metric_type" varchar(50) DEFAULT 'skill' NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_metric_goals" ADD COLUMN "metric_name" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_metric_goals" DROP COLUMN IF EXISTS "metric";