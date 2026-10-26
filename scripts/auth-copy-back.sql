-- Better Auth 2/4 (epic #250, issue #252): rollback helper. After the cutover,
-- sign-ups and account links exist only in the Better Auth tables. If the app
-- is rolled back to the NextAuth image, run this so those users can still sign
-- in:
--
--   docker exec -i <container> psql -U <user> -d <db> -v ON_ERROR_STOP=1 < scripts/auth-copy-back.sql
--
-- Idempotent and additive: it never overwrites an existing NextAuth row or
-- password. Remove it in the contract phase (#254).

-- OAuth accounts back into NextAuth's table (`expires_at` in seconds).
INSERT INTO "bingoscape-next_account"
  ("user_id", "type", "provider", "provider_account_id", "access_token", "refresh_token", "id_token", "expires_at", "scope")
SELECT "user_id", 'oauth', "provider_id", "account_id", "access_token", "refresh_token", "id_token",
  extract(epoch FROM "access_token_expires_at")::integer, "scope"
FROM "bingoscape-next_auth_account"
WHERE "provider_id" <> 'credential'
ON CONFLICT ("provider", "provider_account_id") DO NOTHING;

-- Passwords back onto the user row, only where it has none.
UPDATE "bingoscape-next_user" u
SET "password" = a."password"
FROM "bingoscape-next_auth_account" a
WHERE a."provider_id" = 'credential'
  AND a."user_id" = u."id"
  AND a."password" IS NOT NULL
  AND u."password" IS NULL;
