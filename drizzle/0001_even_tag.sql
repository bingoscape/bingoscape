CREATE TABLE IF NOT EXISTS "bingoscape-next_discord_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"webhook_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_discord_webhooks" ADD CONSTRAINT "bingoscape-next_discord_webhooks_event_id_bingoscape-next_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."bingoscape-next_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_discord_webhooks" ADD CONSTRAINT "bingoscape-next_discord_webhooks_created_by_bingoscape-next_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
