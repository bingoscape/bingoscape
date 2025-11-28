CREATE TABLE IF NOT EXISTS "bingoscape-next_column_bonuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bingo_id" uuid NOT NULL,
	"column_index" integer NOT NULL,
	"bonus_xp" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_row_bonuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bingo_id" uuid NOT NULL,
	"row_index" integer NOT NULL,
	"bonus_xp" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingos" ADD COLUMN "main_diagonal_bonus_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingos" ADD COLUMN "anti_diagonal_bonus_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_column_bonuses" ADD CONSTRAINT "bingoscape-next_column_bonuses_bingo_id_bingoscape-next_bingos_id_fk" FOREIGN KEY ("bingo_id") REFERENCES "public"."bingoscape-next_bingos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_row_bonuses" ADD CONSTRAINT "bingoscape-next_row_bonuses_bingo_id_bingoscape-next_bingos_id_fk" FOREIGN KEY ("bingo_id") REFERENCES "public"."bingoscape-next_bingos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bingo_column_unique" ON "bingoscape-next_column_bonuses" USING btree ("bingo_id","column_index");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bingo_row_unique" ON "bingoscape-next_row_bonuses" USING btree ("bingo_id","row_index");