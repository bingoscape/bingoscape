DO $$ BEGIN
 CREATE TYPE "public"."logical_operator" AS ENUM('AND', 'OR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_goal_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tile_id" uuid NOT NULL,
	"parent_group_id" uuid,
	"logical_operator" "logical_operator" NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bingoscape-next_goals" ADD COLUMN "parent_group_id" uuid;--> statement-breakpoint
ALTER TABLE "bingoscape-next_goals" ADD COLUMN "order_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_goal_groups" ADD CONSTRAINT "bingoscape-next_goal_groups_tile_id_bingoscape-next_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."bingoscape-next_tiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_goal_groups" ADD CONSTRAINT "bingoscape-next_goal_groups_parent_group_id_bingoscape-next_goal_groups_id_fk" FOREIGN KEY ("parent_group_id") REFERENCES "public"."bingoscape-next_goal_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_goals" ADD CONSTRAINT "bingoscape-next_goals_parent_group_id_bingoscape-next_goal_groups_id_fk" FOREIGN KEY ("parent_group_id") REFERENCES "public"."bingoscape-next_goal_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
