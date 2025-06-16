DO $$ BEGIN
 CREATE TYPE "public"."clan_role" AS ENUM('admin', 'management', 'member', 'guest');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_role" AS ENUM('admin', 'management', 'participant');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."registration_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'needs_review');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'management');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_account" (
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "bingoscape-next_account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"key" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used" timestamp,
	CONSTRAINT "bingoscape-next_api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_bingo_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"preview_image" varchar(255),
	"creator_id" uuid,
	"original_bingo_id" uuid,
	"category" varchar(100),
	"tags" varchar(255),
	"is_public" boolean DEFAULT true NOT NULL,
	"template_data" text NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_bingos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"rows" integer NOT NULL,
	"columns" integer NOT NULL,
	"codephrase" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"visible" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_clan_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clan_id" uuid NOT NULL,
	"invite_code" varchar(10) NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bingoscape-next_clan_invites_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_clan_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"role" "clan_role" DEFAULT 'guest' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_clans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"owner_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_event_buy_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_participant_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_event_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"invite_code" varchar(10) NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bingoscape-next_event_invites_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_event_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "event_role" DEFAULT 'participant' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_event_registration_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "registration_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"admin_notes" text,
	"response_message" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"registration_deadline" timestamp,
	"creator_id" uuid,
	"clan_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	"basePrizePool" bigint DEFAULT 0 NOT NULL,
	"minimumBuyIn" bigint DEFAULT 0 NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tile_id" uuid NOT NULL,
	"description" text NOT NULL,
	"target_value" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" varchar(4096) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"tile_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_session" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_tile_submission_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	"goal_id" uuid,
	"submitted_by" uuid NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_team_goal_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_leader" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_team_tile_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tile_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_tiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bingo_id" uuid NOT NULL,
	"header_image" varchar(255),
	"title" text NOT NULL,
	"description" text NOT NULL,
	"weight" integer NOT NULL,
	"index" integer NOT NULL,
	"is_hidden" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"email_verified" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"image" varchar(255),
	"runescapeName" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_verification_token" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "bingoscape-next_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_account" ADD CONSTRAINT "bingoscape-next_account_user_id_bingoscape-next_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_api_keys" ADD CONSTRAINT "bingoscape-next_api_keys_user_id_bingoscape-next_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_bingo_templates" ADD CONSTRAINT "bingoscape-next_bingo_templates_creator_id_bingoscape-next_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_bingo_templates" ADD CONSTRAINT "bingoscape-next_bingo_templates_original_bingo_id_bingoscape-next_bingos_id_fk" FOREIGN KEY ("original_bingo_id") REFERENCES "public"."bingoscape-next_bingos"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_bingos" ADD CONSTRAINT "bingoscape-next_bingos_event_id_bingoscape-next_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."bingoscape-next_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_clan_invites" ADD CONSTRAINT "bingoscape-next_clan_invites_clan_id_bingoscape-next_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."bingoscape-next_clans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_clan_members" ADD CONSTRAINT "bingoscape-next_clan_members_clan_id_bingoscape-next_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."bingoscape-next_clans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_clan_members" ADD CONSTRAINT "bingoscape-next_clan_members_user_id_bingoscape-next_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_clans" ADD CONSTRAINT "bingoscape-next_clans_owner_id_bingoscape-next_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_event_buy_ins" ADD CONSTRAINT "bingoscape-next_event_buy_ins_event_participant_id_bingoscape-next_event_participants_id_fk" FOREIGN KEY ("event_participant_id") REFERENCES "public"."bingoscape-next_event_participants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_event_invites" ADD CONSTRAINT "bingoscape-next_event_invites_event_id_bingoscape-next_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."bingoscape-next_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_event_participants" ADD CONSTRAINT "bingoscape-next_event_participants_event_id_bingoscape-next_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."bingoscape-next_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_event_participants" ADD CONSTRAINT "bingoscape-next_event_participants_user_id_bingoscape-next_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_event_registration_requests" ADD CONSTRAINT "bingoscape-next_event_registration_requests_event_id_bingoscape-next_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."bingoscape-next_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_event_registration_requests" ADD CONSTRAINT "bingoscape-next_event_registration_requests_user_id_bingoscape-next_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_event_registration_requests" ADD CONSTRAINT "bingoscape-next_event_registration_requests_reviewed_by_bingoscape-next_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_events" ADD CONSTRAINT "bingoscape-next_events_creator_id_bingoscape-next_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_events" ADD CONSTRAINT "bingoscape-next_events_clan_id_bingoscape-next_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."bingoscape-next_clans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_goals" ADD CONSTRAINT "bingoscape-next_goals_tile_id_bingoscape-next_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."bingoscape-next_tiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_notifications" ADD CONSTRAINT "bingoscape-next_notifications_user_id_bingoscape-next_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_notifications" ADD CONSTRAINT "bingoscape-next_notifications_event_id_bingoscape-next_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."bingoscape-next_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_notifications" ADD CONSTRAINT "bingoscape-next_notifications_tile_id_bingoscape-next_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."bingoscape-next_tiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_notifications" ADD CONSTRAINT "bingoscape-next_notifications_team_id_bingoscape-next_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bingoscape-next_teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_session" ADD CONSTRAINT "bingoscape-next_session_user_id_bingoscape-next_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_submissions" ADD CONSTRAINT "bingoscape-next_submissions_team_tile_submission_id_bingoscape-next_team_tile_submissions_id_fk" FOREIGN KEY ("team_tile_submission_id") REFERENCES "public"."bingoscape-next_team_tile_submissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_submissions" ADD CONSTRAINT "bingoscape-next_submissions_image_id_bingoscape-next_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."bingoscape-next_images"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_submissions" ADD CONSTRAINT "bingoscape-next_submissions_goal_id_bingoscape-next_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."bingoscape-next_goals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_submissions" ADD CONSTRAINT "bingoscape-next_submissions_submitted_by_bingoscape-next_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_submissions" ADD CONSTRAINT "bingoscape-next_submissions_reviewed_by_bingoscape-next_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_goal_progress" ADD CONSTRAINT "bingoscape-next_team_goal_progress_team_id_bingoscape-next_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bingoscape-next_teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_goal_progress" ADD CONSTRAINT "bingoscape-next_team_goal_progress_goal_id_bingoscape-next_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."bingoscape-next_goals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_members" ADD CONSTRAINT "bingoscape-next_team_members_team_id_bingoscape-next_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bingoscape-next_teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_members" ADD CONSTRAINT "bingoscape-next_team_members_user_id_bingoscape-next_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_tile_submissions" ADD CONSTRAINT "bingoscape-next_team_tile_submissions_tile_id_bingoscape-next_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."bingoscape-next_tiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_tile_submissions" ADD CONSTRAINT "bingoscape-next_team_tile_submissions_team_id_bingoscape-next_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bingoscape-next_teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_tile_submissions" ADD CONSTRAINT "bingoscape-next_team_tile_submissions_reviewed_by_bingoscape-next_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_teams" ADD CONSTRAINT "bingoscape-next_teams_event_id_bingoscape-next_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."bingoscape-next_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_tiles" ADD CONSTRAINT "bingoscape-next_tiles_bingo_id_bingoscape-next_bingos_id_fk" FOREIGN KEY ("bingo_id") REFERENCES "public"."bingoscape-next_bingos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "bingoscape-next_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_user_main_clan" ON "bingoscape-next_clan_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "bingoscape-next_session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "goal_team_unique" ON "bingoscape-next_team_goal_progress" USING btree ("goal_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tile_team_unique" ON "bingoscape-next_team_tile_submissions" USING btree ("tile_id","team_id");