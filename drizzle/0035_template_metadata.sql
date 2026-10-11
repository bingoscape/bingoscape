ALTER TABLE "bingoscape-next_bingo_templates" ADD COLUMN "schema_version" varchar(20);--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingo_templates" ADD COLUMN "bingo_type" "bingo_type";--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingo_templates" ADD COLUMN "rows" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingo_templates" ADD COLUMN "columns" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingo_templates" ADD COLUMN "tile_count" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingo_templates" ADD COLUMN "tier_count" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingo_templates" ADD COLUMN "total_xp" bigint;--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingo_templates" ADD COLUMN "has_pattern_bonuses" boolean;--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingo_templates" ADD COLUMN "has_hidden_tiles" boolean;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bingo_templates_public_created_idx" ON "bingoscape-next_bingo_templates" USING btree ("is_public","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bingo_templates_creator_idx" ON "bingoscape-next_bingo_templates" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bingo_templates_category_idx" ON "bingoscape-next_bingo_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bingo_templates_public_size_idx" ON "bingoscape-next_bingo_templates" USING btree ("is_public","rows","columns");