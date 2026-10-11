-- A user can only be in a clan once. Drop any pre-existing duplicate rows
-- (keeping the main-clan row, then the highest role, then the oldest) so the
-- unique index below can be created.
DELETE FROM "bingoscape-next_clan_members" cm
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY clan_id, user_id
           ORDER BY is_main DESC,
                    CASE role WHEN 'admin' THEN 0 WHEN 'management' THEN 1 WHEN 'member' THEN 2 ELSE 3 END,
                    joined_at ASC,
                    id ASC
         ) AS rn
  FROM "bingoscape-next_clan_members"
) ranked
WHERE cm.id = ranked.id AND ranked.rn > 1;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_clan_user" ON "bingoscape-next_clan_members" USING btree ("clan_id","user_id");