-- Drop the skill_level column first (has dependency on enum)
ALTER TABLE "bingoscape-next_player_metadata" DROP COLUMN IF EXISTS "skill_level";

-- Then drop the skill_level enum type
DROP TYPE IF EXISTS "public"."skill_level";