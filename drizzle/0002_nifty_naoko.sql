CREATE TABLE IF NOT EXISTS "bingoscape-next_goal_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"value" real NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bingoscape-next_submissions" ADD COLUMN "submission_value" real DEFAULT 1 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_goal_values" ADD CONSTRAINT "bingoscape-next_goal_values_goal_id_bingoscape-next_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."bingoscape-next_goals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
