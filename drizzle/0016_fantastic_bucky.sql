DO $$ BEGIN
 CREATE TYPE "public"."skill_level" AS ENUM('beginner', 'intermediate', 'advanced', 'expert', 'pvmgod');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "bingoscape-next_submissions" ADD COLUMN "is_auto_submission" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_submissions" ADD COLUMN "source_npc_id" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_submissions" ADD COLUMN "source_name" varchar(255);--> statement-breakpoint
ALTER TABLE "bingoscape-next_submissions" ADD COLUMN "source_item_id" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_submissions" ADD COLUMN "plugin_account_name" varchar(255);--> statement-breakpoint
ALTER TABLE "bingoscape-next_submissions" ADD COLUMN "source_type" varchar(100);