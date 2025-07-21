CREATE TABLE IF NOT EXISTS "bingoscape-next_tier_xp_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bingo_id" uuid NOT NULL,
	"tier" integer NOT NULL,
	"xp_required" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bingoscape-next_bingos" ALTER COLUMN "tiers_unlock_requirement" SET DEFAULT 5;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_tier_xp_requirements" ADD CONSTRAINT "bingoscape-next_tier_xp_requirements_bingo_id_bingoscape-next_bingos_id_fk" FOREIGN KEY ("bingo_id") REFERENCES "public"."bingoscape-next_bingos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bingo_tier_unique" ON "bingoscape-next_tier_xp_requirements" USING btree ("bingo_id","tier");