ALTER TABLE "bingoscape-next_events" ALTER COLUMN "start_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bingoscape-next_events" ALTER COLUMN "end_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bingoscape-next_events" ALTER COLUMN "registration_deadline" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bingoscape-next_events" ADD COLUMN "timezone" varchar(100) DEFAULT 'UTC' NOT NULL;