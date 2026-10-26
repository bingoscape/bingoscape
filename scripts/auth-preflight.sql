-- Better Auth migration pre-flight (#251, epic #250).
--
-- Read-only: counts the rows Better Auth would reject or treat differently.
-- Prints counts only, never row data, so the output can be pasted into a
-- public issue. Run it against a restored backup, not production:
--
--   docker exec -i <container> psql -U <user> -d <db> -v ON_ERROR_STOP=1 < scripts/auth-preflight.sql
--
-- A check is fine when its count is 0; the baseline rows are not checks.

BEGIN READ ONLY;

SELECT check_name, count FROM (
  -- Better Auth requires an email on every user.
  SELECT 1 AS ord, 'users_without_email' AS check_name, count(*) AS count
  FROM "bingoscape-next_user" WHERE "email" IS NULL OR btrim("email") = ''

  -- Better Auth lowercases emails; two rows that differ only in case collide.
  UNION ALL SELECT 2, 'email_case_duplicate_groups', count(*) FROM (
    SELECT 1 FROM "bingoscape-next_user" WHERE "email" IS NOT NULL
    GROUP BY lower("email") HAVING count(*) > 1
  ) d

  -- Stored with capitals: a lookup by the lowercased email would miss them.
  UNION ALL SELECT 3, 'emails_not_lowercase', count(*)
  FROM "bingoscape-next_user" WHERE "email" <> lower("email")

  -- Better Auth expects a name on every user.
  UNION ALL SELECT 4, 'users_without_name', count(*)
  FROM "bingoscape-next_user" WHERE "name" IS NULL OR btrim("name") = ''

  -- The username plugin lowercases input before the lookup.
  UNION ALL SELECT 5, 'usernames_not_lowercase', count(*)
  FROM "bingoscape-next_user" WHERE "username" <> lower("username")

  -- Outside today's sign-in rule (3-30 of letters, digits, '_', '-').
  UNION ALL SELECT 6, 'usernames_outside_current_rule', count(*)
  FROM "bingoscape-next_user" WHERE "username" !~ '^[a-zA-Z0-9_-]{3,30}$'

  -- The plugin's default validator allows '.' but not '-'; these need a custom validator.
  UNION ALL SELECT 7, 'usernames_with_hyphen', count(*)
  FROM "bingoscape-next_user" WHERE "username" LIKE '%-%'

  -- Not a bcrypt hash ($2a$/$2b$/$2y$), so the bcrypt verify would reject it.
  UNION ALL SELECT 8, 'passwords_not_bcrypt', count(*)
  FROM "bingoscape-next_user" WHERE "password" IS NOT NULL AND "password" !~ '^\$2[aby]\$'

  -- Baseline for the phase 2 count checks.
  UNION ALL SELECT 20, 'baseline_users', count(*) FROM "bingoscape-next_user"
  UNION ALL SELECT 21, 'baseline_users_with_password', count(*)
  FROM "bingoscape-next_user" WHERE "password" IS NOT NULL
  UNION ALL SELECT 22, 'baseline_users_password_and_oauth', count(*)
  FROM "bingoscape-next_user" u
  WHERE u."password" IS NOT NULL
    AND EXISTS (SELECT 1 FROM "bingoscape-next_account" a WHERE a."user_id" = u."id")
  UNION ALL SELECT 23, 'baseline_users_with_provider_verified_email', count(*)
  FROM "bingoscape-next_user" WHERE "provider_verified_email" IS NOT NULL
  UNION ALL SELECT 24, 'baseline_sessions', count(*) FROM "bingoscape-next_session"
  UNION ALL SELECT 25, 'baseline_verification_tokens', count(*) FROM "bingoscape-next_verification_token"
) checks
ORDER BY ord;

-- Accounts per provider and type (provider names are not personal data).
SELECT 'baseline_accounts' AS check_name, "provider", "type", count(*) AS count
FROM "bingoscape-next_account"
GROUP BY "provider", "type"
ORDER BY "provider", "type";

ROLLBACK;
