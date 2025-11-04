ALTER TABLE "bingoscape-next_player_metadata" ADD COLUMN "combat_level" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_player_metadata" ADD COLUMN "total_level" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_player_metadata" ADD COLUMN "wom_player_data" text;--> statement-breakpoint
ALTER TABLE "bingoscape-next_player_metadata" ADD COLUMN "last_fetched_from_wom" timestamp;