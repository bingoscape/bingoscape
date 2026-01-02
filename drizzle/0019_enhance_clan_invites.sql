-- Add new columns to clan_invites table for permanent invite link management

-- Add createdBy to track who created each invite
ALTER TABLE "bingoscape-next_clan_invites" ADD COLUMN "created_by" uuid;

-- Add label for friendly invite identification
ALTER TABLE "bingoscape-next_clan_invites" ADD COLUMN "label" varchar(100);

-- Add maxUses for usage limits (NULL = unlimited)
ALTER TABLE "bingoscape-next_clan_invites" ADD COLUMN "max_uses" integer;

-- Add currentUses to track usage count
ALTER TABLE "bingoscape-next_clan_invites" ADD COLUMN "current_uses" integer DEFAULT 0 NOT NULL;

-- Add isActive for manual revocation (soft delete)
ALTER TABLE "bingoscape-next_clan_invites" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;

-- Add updatedAt to track modifications
ALTER TABLE "bingoscape-next_clan_invites" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;

-- Add foreign key constraint for createdBy
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_clan_invites" ADD CONSTRAINT "bingoscape-next_clan_invites_created_by_bingoscape-next_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "bingoscape-next_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Set createdBy to clan owner for existing invites
UPDATE "bingoscape-next_clan_invites" ci
SET "created_by" = c."owner_id"
FROM "bingoscape-next_clans" c
WHERE ci."clan_id" = c."id" AND ci."created_by" IS NULL;

-- Create index on clan_id for efficient lookups
CREATE INDEX IF NOT EXISTS "clan_invites_clan_id_idx" ON "bingoscape-next_clan_invites" ("clan_id");

-- Create index on invite_code for join operations
CREATE INDEX IF NOT EXISTS "clan_invites_invite_code_idx" ON "bingoscape-next_clan_invites" ("invite_code");
