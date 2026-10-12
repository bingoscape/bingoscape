ALTER TYPE "bingo_type" ADD VALUE 'battleship';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_battleship_ship_tiles" (
	"ship_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"tile_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_battleship_ships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bingo_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"ship_length" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_bingo_ship_rules" (
	"bingo_id" uuid PRIMARY KEY NOT NULL,
	"rules_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_battleship_ship_tiles" ADD CONSTRAINT "bingoscape-next_battleship_ship_tiles_ship_id_bingoscape-next_battleship_ships_id_fk" FOREIGN KEY ("ship_id") REFERENCES "public"."bingoscape-next_battleship_ships"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_battleship_ship_tiles" ADD CONSTRAINT "bingoscape-next_battleship_ship_tiles_team_id_bingoscape-next_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bingoscape-next_teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_battleship_ship_tiles" ADD CONSTRAINT "bingoscape-next_battleship_ship_tiles_tile_id_bingoscape-next_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."bingoscape-next_tiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_battleship_ships" ADD CONSTRAINT "bingoscape-next_battleship_ships_bingo_id_bingoscape-next_bingos_id_fk" FOREIGN KEY ("bingo_id") REFERENCES "public"."bingoscape-next_bingos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_battleship_ships" ADD CONSTRAINT "bingoscape-next_battleship_ships_team_id_bingoscape-next_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bingoscape-next_teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_bingo_ship_rules" ADD CONSTRAINT "bingoscape-next_bingo_ship_rules_bingo_id_bingoscape-next_bingos_id_fk" FOREIGN KEY ("bingo_id") REFERENCES "public"."bingoscape-next_bingos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "battleship_ship_tiles_ship_tile_unique" ON "bingoscape-next_battleship_ship_tiles" USING btree ("ship_id","tile_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "battleship_ship_tiles_team_tile_unique" ON "bingoscape-next_battleship_ship_tiles" USING btree ("team_id","tile_id");