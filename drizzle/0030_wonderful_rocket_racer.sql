DO $$ BEGIN
 CREATE TYPE "public"."tile_completion_status" AS ENUM('incomplete', 'completed', 'needs_attention');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "bingoscape-next_team_tile_submissions" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "bingoscape-next_team_tile_submissions" ALTER COLUMN "status" SET DATA TYPE tile_completion_status 
USING (
  CASE "status"::text
    WHEN 'pending' THEN 'incomplete'::tile_completion_status
    WHEN 'approved' THEN 'completed'::tile_completion_status
    WHEN 'accepted' THEN 'completed'::tile_completion_status
    WHEN 'needs_review' THEN 'needs_attention'::tile_completion_status
    WHEN 'requires_interaction' THEN 'needs_attention'::tile_completion_status
    WHEN 'incomplete' THEN 'incomplete'::tile_completion_status
    WHEN 'completed' THEN 'completed'::tile_completion_status
    WHEN 'needs_attention' THEN 'needs_attention'::tile_completion_status
    ELSE 'incomplete'::tile_completion_status
  END
);--> statement-breakpoint
ALTER TABLE "bingoscape-next_team_tile_submissions" ALTER COLUMN "status" SET DEFAULT 'incomplete';
--> statement-breakpoint
DO $$ BEGIN
 ALTER TYPE "public"."submission_status" ADD VALUE 'pending';
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TYPE "public"."submission_status" ADD VALUE 'approved';
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TYPE "public"."submission_status" ADD VALUE 'needs_review';
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
UPDATE "bingoscape-next_submissions" SET "status" = 'pending' WHERE "status"::text = 'incomplete';
--> statement-breakpoint
UPDATE "bingoscape-next_submissions" SET "status" = 'approved' WHERE "status"::text = 'completed';
--> statement-breakpoint
UPDATE "bingoscape-next_submissions" SET "status" = 'needs_review' WHERE "status"::text = 'needs_attention';