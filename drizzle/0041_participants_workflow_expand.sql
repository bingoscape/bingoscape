-- Participants workflow 2/N: expand phase.
-- Compatible with the previous app version and safe to re-run (every step is
-- idempotent). Nothing the previous app reads or writes is dropped or renamed.
--
--   * event_registration_requests: at most one pending request per user and
--     event (partial unique index) plus an (event_id, status, created_at) index.
--     Existing duplicate pending requests are closed first: the oldest stays
--     pending, the others become 'rejected' with an admin note (not visible to
--     the user).
--   * event_buy_ins: one row per participant (unique index) and a nullable
--     expected_amount snapshot for partial payments. Duplicate rows (left by the
--     old find-then-insert race) are collapsed to the most recently updated
--     one. NOTE: the prize pool sums buy-in rows, so a participant with
--     duplicate rows counts once afterwards. To see what will be removed first:
--       SELECT * FROM "bingoscape-next_event_buy_ins" b
--       WHERE EXISTS (SELECT 1 FROM "bingoscape-next_event_buy_ins" o
--         WHERE o.event_participant_id = b.event_participant_id AND o.id <> b.id);
--     expected_amount is backfilled with the Event's current minimum buy-in, so
--     the paid/unpaid state managers see today (amount >= minimum) is unchanged.
--     Rows the previous app inserts later leave it NULL, which the app reads as
--     "the current minimum".
--   * indexes on event_donations(event_participant_id) and
--     player_metadata(event_id).
--   * team_generation_runs: preview/apply/undo log for automatic team balancing.
--
-- Rollback note: a rollback does not revert this migration. After it, the
-- previous app version can no longer create a second pending request for the
-- same user and event (its blind insert in the invite flow raises a unique
-- violation instead of a duplicate row) nor a second buy-in row.

DO $$ BEGIN
 CREATE TYPE "public"."team_generation_run_status" AS ENUM('previewed', 'applied', 'undone');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bingoscape-next_team_generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"created_by" uuid,
	"status" "team_generation_run_status" DEFAULT 'previewed' NOT NULL,
	"seed" bigint,
	"config" jsonb NOT NULL,
	"objective" real,
	"plan" jsonb NOT NULL,
	"previous_assignments" jsonb,
	"created_team_ids" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"applied_at" timestamp,
	"undone_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "bingoscape-next_event_buy_ins" ADD COLUMN IF NOT EXISTS "expected_amount" bigint;--> statement-breakpoint
UPDATE "bingoscape-next_event_buy_ins" b
SET "expected_amount" = e."minimumBuyIn"
FROM "bingoscape-next_event_participants" ep
INNER JOIN "bingoscape-next_events" e ON e."id" = ep."event_id"
WHERE ep."id" = b."event_participant_id" AND b."expected_amount" IS NULL;--> statement-breakpoint
WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "event_participant_id"
    ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
  ) AS rn
  FROM "bingoscape-next_event_buy_ins"
)
DELETE FROM "bingoscape-next_event_buy_ins" b
USING ranked r
WHERE b."id" = r."id" AND r.rn > 1;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_generation_runs" ADD CONSTRAINT "bingoscape-next_team_generation_runs_event_id_bingoscape-next_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."bingoscape-next_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_team_generation_runs" ADD CONSTRAINT "bingoscape-next_team_generation_runs_created_by_bingoscape-next_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_generation_runs_event_created_idx" ON "bingoscape-next_team_generation_runs" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_buy_ins_participant_unique" ON "bingoscape-next_event_buy_ins" USING btree ("event_participant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_donations_participant_idx" ON "bingoscape-next_event_donations" USING btree ("event_participant_id");--> statement-breakpoint
WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "event_id", "user_id"
    ORDER BY "created_at" ASC, "id" ASC
  ) AS rn
  FROM "bingoscape-next_event_registration_requests"
  WHERE "status" = 'pending'
)
UPDATE "bingoscape-next_event_registration_requests" r
SET "status" = 'rejected',
    "reviewed_at" = now(),
    "updated_at" = now(),
    "admin_notes" = concat_ws(E'
', r."admin_notes", 'Duplicate pending request closed by migration 0041')
FROM ranked
WHERE r."id" = ranked."id" AND ranked.rn > 1;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_registration_requests_pending_unique" ON "bingoscape-next_event_registration_requests" USING btree ("event_id","user_id") WHERE "bingoscape-next_event_registration_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_registration_requests_event_status_idx" ON "bingoscape-next_event_registration_requests" USING btree ("event_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_metadata_event_idx" ON "bingoscape-next_player_metadata" USING btree ("event_id");
