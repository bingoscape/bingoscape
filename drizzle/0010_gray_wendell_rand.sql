DO $$ BEGIN
 CREATE TYPE "public"."goal_type" AS ENUM('generic', 'item');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_item_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"item_id" integer NOT NULL,
	"base_name" text NOT NULL,
	"exact_variant" text,
	"image_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bingoscape-next_item_goals_goal_id_unique" UNIQUE("goal_id")
);
--> statement-breakpoint
ALTER TABLE "bingoscape-next_goals" ADD COLUMN "goal_type" "goal_type" DEFAULT 'generic' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_item_goals" ADD CONSTRAINT "bingoscape-next_item_goals_goal_id_bingoscape-next_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."bingoscape-next_goals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
