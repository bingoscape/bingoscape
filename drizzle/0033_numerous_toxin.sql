ALTER TABLE "bingoscape-next_team_tile_submissions" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tts_completed_at_id_idx" ON "bingoscape-next_team_tile_submissions" USING btree ("completed_at","id");--> statement-breakpoint
UPDATE "bingoscape-next_team_tile_submissions" SET "completed_at" = "updated_at" WHERE "status" = 'completed' AND "completed_at" IS NULL;
