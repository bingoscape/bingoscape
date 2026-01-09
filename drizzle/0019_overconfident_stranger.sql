ALTER TABLE "bingoscape-next_clan_invites" ADD COLUMN "created_by" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_clan_invites" ADD COLUMN "label" varchar(100);--> statement-breakpoint
ALTER TABLE "bingoscape-next_clan_invites" ADD COLUMN "max_uses" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_clan_invites" ADD COLUMN "current_uses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_clan_invites" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_clan_invites" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "bingoscape-next_submissions" ADD COLUMN "location_world_x" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_submissions" ADD COLUMN "location_world_y" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_submissions" ADD COLUMN "location_plane" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_submissions" ADD COLUMN "location_world_number" integer;--> statement-breakpoint
ALTER TABLE "bingoscape-next_submissions" ADD COLUMN "location_region_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_clan_invites" ADD CONSTRAINT "bingoscape-next_clan_invites_created_by_bingoscape-next_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
