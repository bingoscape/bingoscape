-- RBAC 3/8 (epic #183, issue #186): safety-net trigger for the role ledger.
-- Expand phase, compatible with the previous app version (which writes
-- memberships without setting the audit source and therefore produces
-- source = 'trigger' ledger rows, exactly what the trigger is for).
--
-- Hand-written (no schema change: drizzle-kit only produced the empty file and
-- the unchanged snapshot). Every statement is idempotent.
--
-- How it avoids double logging: changeRole() and its sibling operations set
-- the transaction-local setting `app.audit_source` (set_config(..., true))
-- before they write a membership and insert the ledger row themselves. The
-- trigger returns early whenever that setting is non-empty, so it only logs
-- writes that bypassed the helper.

-- 1. 'trigger' becomes a valid ledger source.
ALTER TABLE "bingoscape-next_role_change_log" DROP CONSTRAINT IF EXISTS "role_change_log_source_check";--> statement-breakpoint
ALTER TABLE "bingoscape-next_role_change_log" ADD CONSTRAINT "role_change_log_source_check" CHECK ("source" IN ('migration', 'app', 'api', 'super_admin', 'system', 'trigger'));--> statement-breakpoint

-- 2. Catch up the ledger. Memberships written (or changed, or removed) by the
--    previous app version between migration 0038 and this one have no or a
--    stale ledger entry. One 'baseline' row per live membership without any
--    entry, one 'backfill' row per live membership whose latest entry has a
--    different role, one 'remove' row per vanished membership whose Event/Clan
--    and user still exist. A second run finds nothing to do.
INSERT INTO "bingoscape-next_role_change_log"
  ("scope_type", "scope_id", "subject_user_id", "action", "old_role", "new_role", "source", "reason")
SELECT 'event', ep."event_id", ep."user_id", 'baseline', NULL, ep."role"::text, 'migration', 'membership without ledger entry at migration 0039'
FROM "bingoscape-next_event_participants" ep
WHERE NOT EXISTS (
  SELECT 1 FROM "bingoscape-next_role_change_log" l
  WHERE l."scope_type" = 'event' AND l."scope_id" = ep."event_id" AND l."subject_user_id" = ep."user_id"
);--> statement-breakpoint
INSERT INTO "bingoscape-next_role_change_log"
  ("scope_type", "scope_id", "subject_user_id", "action", "old_role", "new_role", "source", "reason")
SELECT 'clan', cm."clan_id", cm."user_id", 'baseline', NULL, cm."role"::text, 'migration', 'membership without ledger entry at migration 0039'
FROM "bingoscape-next_clan_members" cm
WHERE NOT EXISTS (
  SELECT 1 FROM "bingoscape-next_role_change_log" l
  WHERE l."scope_type" = 'clan' AND l."scope_id" = cm."clan_id" AND l."subject_user_id" = cm."user_id"
);--> statement-breakpoint
WITH latest AS (
  SELECT DISTINCT ON (scope_type, scope_id, subject_user_id)
         scope_type, scope_id, subject_user_id, new_role
  FROM "bingoscape-next_role_change_log"
  WHERE subject_user_id IS NOT NULL
  ORDER BY scope_type, scope_id, subject_user_id, seq DESC
), live AS (
  SELECT 'event'::text AS scope_type, event_id AS scope_id, user_id AS subject_user_id, role::text AS role
  FROM "bingoscape-next_event_participants"
  UNION ALL
  SELECT 'clan'::text, clan_id, user_id, role::text
  FROM "bingoscape-next_clan_members"
)
INSERT INTO "bingoscape-next_role_change_log"
  ("scope_type", "scope_id", "subject_user_id", "action", "old_role", "new_role", "source", "reason")
SELECT live.scope_type, live.scope_id, live.subject_user_id, 'backfill', latest.new_role, live.role, 'migration', 'role changed outside the ledger before migration 0039'
FROM live
JOIN latest USING (scope_type, scope_id, subject_user_id)
WHERE latest.new_role IS DISTINCT FROM live.role;--> statement-breakpoint
WITH latest AS (
  SELECT DISTINCT ON (scope_type, scope_id, subject_user_id)
         scope_type, scope_id, subject_user_id, new_role
  FROM "bingoscape-next_role_change_log"
  WHERE subject_user_id IS NOT NULL
  ORDER BY scope_type, scope_id, subject_user_id, seq DESC
)
INSERT INTO "bingoscape-next_role_change_log"
  ("scope_type", "scope_id", "subject_user_id", "action", "old_role", "new_role", "source", "reason")
SELECT latest.scope_type, latest.scope_id, latest.subject_user_id, 'remove', latest.new_role, NULL, 'migration', 'membership removed outside the ledger before migration 0039'
FROM latest
WHERE latest.new_role IS NOT NULL
  AND EXISTS (SELECT 1 FROM "bingoscape-next_user" u WHERE u."id" = latest.subject_user_id)
  AND (
    (latest.scope_type = 'event'
      AND EXISTS (SELECT 1 FROM "bingoscape-next_events" e WHERE e."id" = latest.scope_id)
      AND NOT EXISTS (SELECT 1 FROM "bingoscape-next_event_participants" ep WHERE ep."event_id" = latest.scope_id AND ep."user_id" = latest.subject_user_id))
    OR
    (latest.scope_type = 'clan'
      AND EXISTS (SELECT 1 FROM "bingoscape-next_clans" c WHERE c."id" = latest.scope_id)
      AND NOT EXISTS (SELECT 1 FROM "bingoscape-next_clan_members" cm WHERE cm."clan_id" = latest.scope_id AND cm."user_id" = latest.subject_user_id))
  );--> statement-breakpoint

-- 3. One trigger function for both membership tables. TG_ARGV[0] is the ledger
--    scope ('event' | 'clan'), TG_ARGV[1] the name of the parent column.
--    Deletes are not logged when the parent (Event/Clan) or the user is gone:
--    that is a cascade, and the reconciliation query tolerates ledger entries
--    of vanished parents and users.
CREATE OR REPLACE FUNCTION "bingoscape_next_log_membership_change"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  audit_source text := nullif(current_setting('app.audit_source', true), '');
  row_data jsonb;
  parent_id uuid;
  subject_id uuid;
  parent_exists boolean;
BEGIN
  IF audit_source IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
  ELSE
    row_data := to_jsonb(NEW);
  END IF;
  parent_id := (row_data ->> TG_ARGV[1])::uuid;
  subject_id := (row_data ->> 'user_id')::uuid;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO "bingoscape-next_role_change_log"
      ("scope_type", "scope_id", "subject_user_id", "action", "old_role", "new_role", "source", "reason")
    VALUES
      (TG_ARGV[0], parent_id, subject_id, 'add', NULL, NEW."role"::text, 'trigger', 'membership written outside changeRole()');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW."role" IS DISTINCT FROM OLD."role" THEN
      INSERT INTO "bingoscape-next_role_change_log"
        ("scope_type", "scope_id", "subject_user_id", "action", "old_role", "new_role", "source", "reason")
      VALUES
        (TG_ARGV[0], parent_id, subject_id, 'change', OLD."role"::text, NEW."role"::text, 'trigger', 'role written outside changeRole()');
    END IF;
  ELSE
    IF TG_ARGV[0] = 'event' THEN
      SELECT EXISTS (SELECT 1 FROM "bingoscape-next_events" WHERE "id" = parent_id) INTO parent_exists;
    ELSE
      SELECT EXISTS (SELECT 1 FROM "bingoscape-next_clans" WHERE "id" = parent_id) INTO parent_exists;
    END IF;
    IF parent_exists AND EXISTS (SELECT 1 FROM "bingoscape-next_user" WHERE "id" = subject_id) THEN
      INSERT INTO "bingoscape-next_role_change_log"
        ("scope_type", "scope_id", "subject_user_id", "action", "old_role", "new_role", "source", "reason")
      VALUES
        (TG_ARGV[0], parent_id, subject_id, 'remove', OLD."role"::text, NULL, 'trigger', 'membership removed outside changeRole()');
    END IF;
  END IF;

  RETURN NULL;
END;
$fn$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "event_participants_role_ledger" ON "bingoscape-next_event_participants";--> statement-breakpoint
CREATE TRIGGER "event_participants_role_ledger"
AFTER INSERT OR UPDATE OF "role" OR DELETE ON "bingoscape-next_event_participants"
FOR EACH ROW EXECUTE FUNCTION "bingoscape_next_log_membership_change"('event', 'event_id');--> statement-breakpoint

DROP TRIGGER IF EXISTS "clan_members_role_ledger" ON "bingoscape-next_clan_members";--> statement-breakpoint
CREATE TRIGGER "clan_members_role_ledger"
AFTER INSERT OR UPDATE OF "role" OR DELETE ON "bingoscape-next_clan_members"
FOR EACH ROW EXECUTE FUNCTION "bingoscape_next_log_membership_change"('clan', 'clan_id');
