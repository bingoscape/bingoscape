-- Better Auth 2/4 (epic #250, issue #252): copy NextAuth's auth data into the
-- Better Auth tables. Migration 0046 runs it; run it again right after the
-- cutover deploy to pick up sign-ups made in between:
--
--   docker exec -i <container> psql -U <user> -d <db> -v ON_ERROR_STOP=1 < scripts/auth-copy.sql
--
-- Idempotent: rows that already exist are left alone, so a second run adds
-- nothing. Only reads the old tables; nothing in them changes.

-- OAuth accounts. NextAuth's `expires_at` is in seconds.
INSERT INTO "bingoscape-next_auth_account"
  ("user_id", "provider_id", "account_id", "access_token", "refresh_token", "id_token", "access_token_expires_at", "scope")
SELECT "user_id", "provider", "provider_account_id", "access_token", "refresh_token", "id_token",
  to_timestamp("expires_at"), "scope"
FROM "bingoscape-next_account"
ON CONFLICT ("provider_id", "account_id") DO NOTHING;
--> statement-breakpoint

-- Passwords: Better Auth keeps the (bcrypt) hash on a "credential" account
-- whose account id is the user id.
INSERT INTO "bingoscape-next_auth_account" ("user_id", "provider_id", "account_id", "password")
SELECT "id", 'credential', "id"::text, "password"
FROM "bingoscape-next_user"
WHERE "password" IS NOT NULL
ON CONFLICT ("provider_id", "account_id") DO NOTHING;
--> statement-breakpoint

-- Better Auth's verified flag: true where a provider vouched for the email.
UPDATE "bingoscape-next_user"
SET "is_email_verified" = true
WHERE NOT "is_email_verified"
  AND "provider_verified_email" IS NOT NULL
  AND lower("email") = "provider_verified_email";
