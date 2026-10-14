import type { Permission } from "@/lib/authz/permissions"

/**
 * The policy of every public entry point: each export of a `"use server"` file
 * (callable from the browser by anybody) and each route handler method. The
 * registry test (`__tests__/registry.test.ts`) scans the source for those
 * entry points and fails when one is missing here, when an entry here no longer
 * exists, or when a `permission` entry's file never mentions its permission.
 *
 * Add a new action or route here in the same change that adds it, and say what
 * guards it. Keys are `<repo relative path>#<export name>`.
 *
 * Kinds:
 * - `permission`     checked against the Event's permission map
 *                    (`@/lib/authz/permissions`) with `authorize`,
 *                    `requirePermission`, `hasPermission` or a
 *                    `requirePermissionFor<Resource>` resolver, the Event being
 *                    derived from the resource.
 * - `read-policy`    reads gated by the read policy (`@/server/authz/read`).
 * - `authenticated`  any signed-in user; the data is scoped to the caller.
 * - `public`         anonymous callers allowed; `reason` says why that is safe.
 * - `api-key`        RuneLite routes: a valid API key, then the caller's
 *                    standing in the Event (`getApiActor`).
 * - `super-admin`    behind the super-admin guard (`adminAction`).
 * - `secret`         protected by a shared secret (cron).
 * - `framework`      handled by a library (NextAuth).
 */
/**
 * A `permission` entry whose `note` starts with "via " or "enforced by " names
 * the helper that holds the check; the registry test then does not require the
 * permission string in the action's own file.
 */
export type PolicyEntry =
  | {
      kind: "permission"
      permissions: readonly Permission[]
      /** What else narrows it (a Team, the target role, ...). */
      note?: string
    }
  | { kind: "read-policy"; reason: string }
  | { kind: "authenticated"; reason: string }
  | { kind: "public"; reason: string }
  | { kind: "api-key"; reason: string; permissions?: readonly Permission[] }
  | { kind: "super-admin"; reason: string }
  | { kind: "secret"; reason: string }
  | { kind: "framework"; reason: string }

const perm = (
  permissions: Permission | readonly Permission[],
  note?: string
): PolicyEntry => ({
  kind: "permission",
  permissions: Array.isArray(permissions)
    ? (permissions as readonly Permission[])
    : [permissions as Permission],
  ...(note ? { note } : {}),
})
const read = (reason: string): PolicyEntry => ({ kind: "read-policy", reason })
const auth = (reason: string): PolicyEntry => ({
  kind: "authenticated",
  reason,
})
const pub = (reason: string): PolicyEntry => ({ kind: "public", reason })
const apiKey = (
  reason: string,
  permissions?: readonly Permission[]
): PolicyEntry => ({
  kind: "api-key",
  reason,
  ...(permissions ? { permissions } : {}),
})
const superAdmin = (reason: string): PolicyEntry => ({
  kind: "super-admin",
  reason,
})

const A = "src/app/actions/"
const R = "src/app/api/"

const CATALOGUE = "static OSRS item catalogue; no user or Event data"
const SELF = "acts on the signed-in user's own account only"
const SUPER_ADMIN = "super-admin only (adminAction); not an Event permission"

export const POLICY_REGISTRY: Readonly<Record<string, PolicyEntry>> = {
  // --- account ------------------------------------------------------------
  [`${A}api-keys.ts#createApiKey`]: auth(SELF),
  [`${A}api-keys.ts#revokeApiKey`]: auth("revokes only keys owned by the caller"),
  [`${A}api-keys.ts#deleteApiKey`]: auth("deletes only keys owned by the caller"),
  [`${A}auth.ts#registerUser`]: pub("sign-up; anonymous by definition"),
  [`${A}profile.ts#updateProfile`]: auth(SELF),
  [`${A}user.ts#linkRunescapeAccount`]: auth(SELF),
  [`${A}user.ts#revokeAllSessions`]: auth(SELF),
  [`${A}notifications.ts#getNotifications`]: auth(
    "only the signed-in user's own notifications"
  ),
  [`${A}notifications.ts#markNotificationAsRead`]: auth(
    "only the owner of the notification"
  ),

  // --- events -------------------------------------------------------------
  [`${A}events.ts#createEvent`]: auth("any signed-in user may create an Event"),
  [`${A}events.ts#updateEvent`]: perm("event:update"),
  [`${A}events.ts#deleteEventByAdmin`]: perm("event:delete", "owner only"),
  [`${A}events.ts#assignEventToClan`]: perm(
    "event:assign-clan",
    "and a managing role in the Clan"
  ),
  [`${A}events.ts#generateEventInviteLink`]: perm("event:invite"),
  [`${A}events.ts#isRegistrationOpen`]: auth(
    "registration state for the signed-in user; canOverride via event:override-registration"
  ),
  [`${A}events.ts#requestToJoinEvent`]: auth(
    "any signed-in user may ask to join an Event that requires approval"
  ),
  [`${A}events.ts#joinEvent`]: perm(
    "event:override-registration",
    "only for the override; a plain join is open to any signed-in user while registration is open"
  ),
  [`${A}events.ts#joinEventViaInvite`]: auth(
    "the invite code is the capability; joins as participant"
  ),
  [`${A}events.ts#getUserRegistrationStatus`]: auth(
    "the caller's own registration request"
  ),
  [`${A}events.ts#getPendingRegistrationCount`]: perm("registration:review"),
  [`${A}events.ts#getRegistrationRequests`]: perm("registration:review"),
  [`${A}events.ts#approveRegistrationRequest`]: perm(
    "registration:review",
    "Event derived from the request"
  ),
  [`${A}events.ts#rejectRegistrationRequest`]: perm(
    "registration:review",
    "Event derived from the request"
  ),
  [`${A}events.ts#getEventParticipants`]: perm("participant:list"),
  [`${A}events.ts#updateParticipantRole`]: perm(
    "participant:set-role",
    "changeRole() enforces owner, ceiling and last-admin rules"
  ),
  [`${A}events.ts#transferEventOwnership`]: perm(
    "event:transfer-ownership",
    "enforced by transferOwnership() under the Event lock"
  ),
  [`${A}events.ts#assignParticipantToTeam`]: perm("participant:assign-team"),
  [`${A}events.ts#removeParticipantFromEvent`]: perm(
    "participant:remove",
    "removeMember() enforces owner and last-admin rules"
  ),
  [`${A}events.ts#addClanMembersToEvent`]: perm("participant:add"),
  [`${A}events.ts#updateParticipantBuyIn`]: perm("finance:write"),
  [`${A}events.ts#addParticipantDonation`]: perm("finance:write"),
  [`${A}events.ts#updateParticipantDonation`]: perm("finance:write"),
  [`${A}events.ts#removeParticipantDonation`]: perm("finance:write"),
  [`${A}events.ts#getParticipantDonations`]: perm("finance:read"),
  [`${A}events.ts#calculateEventPrizePool`]: read(
    "the prize pool is on the public Event page (content scope)"
  ),
  [`${A}events.ts#getEventRules`]: perm("event:view"),
  [`${A}events.ts#createEventRule`]: perm("event:manage-rules"),
  [`${A}events.ts#updateEventRule`]: perm("event:manage-rules"),
  [`${A}events.ts#deleteEventRule`]: perm("event:manage-rules"),
  [`${A}events.ts#getMiniBoardTiles`]: read("Board read access"),

  // --- clans --------------------------------------------------------------
  [`${A}clan.ts#createClan`]: auth("any signed-in user may create a Clan"),
  [`${A}clan.ts#joinClanWithInvite`]: auth("the invite code is the capability"),
  [`${A}clan.ts#leaveClan`]: auth(SELF),
  [`${A}clan.ts#updateMemberRole`]: auth(
    "Clan role ladder (clans are a separate scope from Events); changeRole() enforces it"
  ),
  [`${A}clan.ts#createClanInvite`]: auth("Clan managers only (Clan role ladder)"),
  [`${A}clan.ts#revokeClanInvite`]: auth("Clan managers only (Clan role ladder)"),
  [`${A}clan.ts#deleteClanInvite`]: auth("Clan managers only (Clan role ladder)"),
  [`${A}clan.ts#updateClanInviteLabel`]: auth(
    "Clan managers only (Clan role ladder)"
  ),
  [`${A}clan.ts#getUserClans`]: auth("the signed-in user's own Clans"),
  [`${A}clan.ts#getClanMembersForEvent`]: perm("participant:add"),

  // --- teams --------------------------------------------------------------
  [`${A}team.ts#createTeam`]: perm("team:manage"),
  [`${A}team.ts#addUserToTeam`]: perm("team:manage"),
  [`${A}team.ts#removeUserFromTeam`]: perm("team:manage"),
  [`${A}team.ts#deleteTeam`]: perm("team:manage"),
  [`${A}team.ts#updateTeamName`]: perm("team:manage"),
  [`${A}team.ts#updateTeamMember`]: perm("team:manage"),
  [`${A}team.ts#getEventParticipants`]: perm("participant:list"),
  [`${A}team.ts#assignParticipantToTeam`]: perm("participant:assign-team"),
  [`${A}team.ts#getCurrentTeamForUser`]: auth("the caller's own Team"),
  [`${A}team.ts#getTeamsByEventId`]: read("Event content scope"),
  [`${A}team-balancing.ts#generateBalancedTeams`]: perm("team:manage"),
  [`${A}team-balancing.ts#calculateTeamBalanceMetrics`]: perm("stats:read"),
  [`${A}team-balancing.ts#canUseBalancedGeneration`]: perm(
    "player-metadata:read",
    "via calculateMetadataCoverage"
  ),
  [`${A}team-statistics.ts#getEventTeamStatistics`]: perm("stats:read"),

  // --- player metadata ----------------------------------------------------
  [`${A}player-metadata.ts#getPlayerMetadata`]: perm(
    ["player-metadata:read", "event:view"],
    "managers read anyone's; a participant reads their own without the notes"
  ),
  [`${A}player-metadata.ts#getEventParticipantMetadata`]: perm(
    "player-metadata:read"
  ),
  [`${A}player-metadata.ts#updatePlayerMetadata`]: perm("player-metadata:write"),
  [`${A}player-metadata.ts#updateOwnPlayerMetadata`]: perm(
    "player-metadata:write-own",
    "always the caller's own row"
  ),
  [`${A}player-metadata.ts#deletePlayerMetadata`]: perm("player-metadata:write"),
  [`${A}player-metadata.ts#calculateMetadataCoverage`]: perm(
    "player-metadata:read"
  ),
  [`${A}player-metadata.ts#fetchWOMDataForPlayer`]: perm("player-metadata:write"),
  [`${A}wiseoldman.ts#fetchPlayerDataFromWOM`]: auth(
    "spends the server's WiseOldMan quota: signed-in users only"
  ),
  [`${A}wiseoldman.ts#updatePlayerOnWOM`]: auth(
    "spends the server's WiseOldMan quota: signed-in users only"
  ),
  [`${A}wiseoldman.ts#fetchCompetitionFromWOM`]: auth(
    "spends the server's WiseOldMan quota: signed-in users only"
  ),

  // --- boards, tiles ------------------------------------------------------
  [`${A}bingo.ts#createBingo`]: perm("board:manage"),
  [`${A}bingo.ts#deleteBingo`]: perm("board:manage"),
  [`${A}bingo.ts#updateBingo`]: perm("board:manage"),
  [`${A}bingo.ts#getBingoWithPatternBonuses`]: perm("board:manage"),
  [`${A}bingo.ts#updateTile`]: perm("board:manage"),
  [`${A}bingo.ts#reorderTiles`]: perm("board:manage"),
  [`${A}bingo.ts#addRowOrColumn`]: perm("board:manage"),
  [`${A}bingo.ts#deleteRowOrColumn`]: perm("board:manage"),
  [`${A}bingo.ts#addTile`]: perm("board:manage"),
  [`${A}bingo.ts#deleteTile`]: perm("board:manage"),
  [`${A}bingo.ts#updateTileTier`]: perm("board:manage"),
  [`${A}bingo.ts#getTierXpRequirements`]: perm("board:manage"),
  [`${A}bingo.ts#setTierXpRequirement`]: perm("board:manage"),
  [`${A}bingo.ts#initializeTierXpRequirements`]: perm("board:manage"),
  [`${A}bingo.ts#createNewTier`]: perm("board:manage"),
  [`${A}bingo.ts#deleteTier`]: perm("board:manage"),
  [`${A}bingo.ts#initializeTeamTierProgress`]: perm(
    "team:access",
    "enforced by requireTeamMemberOrManager; the Board must belong to the Team's Event"
  ),
  [`${A}bingo.ts#checkAndUnlockNextTier`]: perm(
    "team:access",
    "enforced by requireTeamMemberOrManager; the Board must belong to the Team's Event"
  ),
  [`${A}getBingoById.ts#getBingoById`]: read("Board read access"),
  [`${A}bingo-import-export.ts#exportBingoBoard`]: perm("board:manage"),
  [`${A}bingo-import-export.ts#importBingoBoard`]: perm("board:manage"),
  [`${A}bingo-import-export.ts#validateImportData`]: pub(
    "pure schema validation of the argument; touches no data"
  ),
  [`${A}battleship.ts#saveTeamShipPlacements`]: perm(
    "team:lead",
    "enforced by assertTeamLeaderOrManager: a Team's leader, or a manager"
  ),
  [`${A}battleship.ts#updateBingoShipRules`]: perm("board:manage"),
  [`${A}tracker.ts#syncTrackerProgress`]: perm("board:manage"),
  [`${A}tracker.ts#createWiseOldManCompetition`]: perm("board:manage"),
  [`${A}tracker.ts#linkWiseOldManCompetition`]: perm("board:manage"),
  [`${A}tracker.ts#unlinkWiseOldManCompetition`]: perm("board:manage"),

  // --- goals --------------------------------------------------------------
  [`${A}bingo.ts#createGoals`]: perm("board:manage"),
  [`${A}bingo.ts#addGoal`]: perm("board:manage", "via createGoals"),
  [`${A}bingo.ts#createItemGoal`]: perm("board:manage", "via createGoals"),
  [`${A}bingo.ts#createMetricGoal`]: perm("board:manage", "via createGoals"),
  [`${A}bingo.ts#updateGoal`]: perm("board:manage"),
  [`${A}bingo.ts#updateMetricGoal`]: perm("board:manage"),
  [`${A}bingo.ts#updateItemGoal`]: perm("board:manage"),
  [`${A}bingo.ts#deleteGoal`]: perm("board:manage"),
  [`${A}bingo.ts#updateGoalProgress`]: perm("board:manage"),
  [`${A}bingo.ts#getGoalWithItemData`]: read("Goal read access"),
  [`${A}bingo.ts#getItemGoalsForTile`]: read("Tile read access"),
  [`${A}bingo.ts#getTileGoalsAndProgress`]: read("Tile read access"),
  [`${A}goal-batch.ts#applyGoalsToTiles`]: perm("board:manage"),
  [`${A}goal-groups.ts#createGoalGroup`]: perm("board:manage"),
  [`${A}goal-groups.ts#updateGoalGroup`]: perm("board:manage"),
  [`${A}goal-groups.ts#deleteGoalGroup`]: perm("board:manage"),
  [`${A}goal-groups.ts#moveGoalToGroup`]: perm("board:manage"),
  [`${A}goal-groups.ts#moveGroupToGroup`]: perm("board:manage"),
  [`${A}goal-groups.ts#reorderItems`]: perm("board:manage"),
  [`${A}goal-groups.ts#moveMultipleItems`]: perm("board:manage"),
  [`${A}goal-groups.ts#getGoalTree`]: read("Tile read access"),
  [`${A}goal-groups.ts#getGoalTreeWithProgress`]: read("Tile read access"),
  [`${A}goals.ts#addGoalValue`]: perm("board:manage"),
  [`${A}goals.ts#deleteGoalValue`]: perm("board:manage"),
  [`${A}goals.ts#getGoalValues`]: read("Goal read access"),
  [`${A}goals.ts#updateSubmissionGoalAndValue`]: perm("submission:review"),

  // --- submissions --------------------------------------------------------
  [`${A}bingo.ts#submitImage`]: perm(
    ["submission:create", "submission:create-on-behalf"],
    "a manager for any Team, a member for their own"
  ),
  [`${A}bingo.ts#getSelectableUsersForSubmission`]: perm(
    ["submission:create-on-behalf", "team:access"],
    "managers see every participant, a member only their own Team"
  ),
  [`${A}bingo.ts#getAllSubmissionsForTeam`]: perm(
    "team:access",
    "enforced by requireTeamMemberOrManager: the Team itself, or a manager"
  ),
  [`${A}bingo.ts#updateSubmissionStatus`]: perm("submission:review"),
  [`${A}bingo.ts#updateSubmissionStatusWithComment`]: perm("submission:review"),
  [`${A}bingo.ts#updateTeamTileSubmissionStatus`]: perm("submission:review"),
  [`${A}bingo.ts#deleteSubmission`]: perm("submission:review"),
  [`${A}getSubmissions.ts#getEventSubmissions`]: perm("submission:review"),

  // --- webhooks -----------------------------------------------------------
  [`${A}discord-webhooks.ts#getDiscordWebhooks`]: perm("webhook:manage"),
  [`${A}discord-webhooks.ts#createDiscordWebhook`]: perm("webhook:manage"),
  [`${A}discord-webhooks.ts#updateDiscordWebhook`]: perm("webhook:manage"),
  [`${A}discord-webhooks.ts#deleteDiscordWebhook`]: perm("webhook:manage"),
  [`${A}discord-webhooks.ts#testWebhook`]: perm("webhook:manage"),

  // --- templates ----------------------------------------------------------
  [`${A}templates.ts#saveBingoAsTemplate`]: perm(
    "board:manage",
    "enforced by exportBingoBoard; the template is owned by the caller"
  ),
  [`${A}templates.ts#updateTemplate`]: auth("only the template's creator"),
  [`${A}templates.ts#deleteTemplate`]: auth("only the template's creator"),
  [`${A}templates.ts#importTemplateIntoEvent`]: perm(
    "board:manage",
    "enforced by importBingoBoard on the target Event; the template must be public or the caller's"
  ),

  // --- public pages -------------------------------------------------------
  [`${A}public-events.ts#getPublicEvent`]: pub(
    "public Events only, redacted like the Event page (read policy)"
  ),
  [`${A}public-events.ts#getPublicBingos`]: pub(
    "public Events only, redacted like the Event page (read policy)"
  ),
  [`${A}public-events.ts#getPublicBingoDetails`]: pub(
    "public Events only, redacted like the Event page (read policy)"
  ),
  [`${A}public-events.ts#getPublicWorkspaceData`]: pub(
    "public Events only, redacted like the Event page (read policy)"
  ),

  // --- OSRS item catalogue ------------------------------------------------
  [`${A}osrs-items.ts#searchOsrsItems`]: pub(CATALOGUE),
  [`${A}osrs-items.ts#resolveOsrsItemNames`]: pub(CATALOGUE),
  [`${A}osrs-items.ts#getOsrsItemById`]: pub(CATALOGUE),
  [`${A}osrs-items.ts#getOsrsItemVariantsById`]: pub(CATALOGUE),
  [`${A}osrs-items.ts#getOsrsItemByName`]: pub(CATALOGUE),
  [`${A}osrs-items.ts#getOsrsItemVariantsByBaseName`]: pub(CATALOGUE),
  [`${A}osrs-items.ts#parseOsrsItemName`]: pub(CATALOGUE),
  [`${A}osrs-items.ts#getOsrsItemImageUrl`]: pub(CATALOGUE),
  [`${A}osrs-items.ts#doesItemMatchBaseName`]: pub(CATALOGUE),

  // --- super admin --------------------------------------------------------
  [`${A}super-admin.ts#updateUser`]: superAdmin(SUPER_ADMIN),
  [`${A}super-admin.ts#deleteUser`]: superAdmin(SUPER_ADMIN),
  [`${A}super-admin.ts#updateClan`]: superAdmin(SUPER_ADMIN),
  [`${A}super-admin.ts#deleteClan`]: superAdmin(SUPER_ADMIN),
  [`${A}super-admin.ts#removeClanMember`]: superAdmin(SUPER_ADMIN),
  [`${A}super-admin.ts#updateClanMemberRole`]: superAdmin(SUPER_ADMIN),
  [`${A}super-admin.ts#updateEvent`]: superAdmin(SUPER_ADMIN),
  [`${A}super-admin.ts#deleteEvent`]: superAdmin(SUPER_ADMIN),
  [`${A}super-admin.ts#removeEventParticipant`]: superAdmin(SUPER_ADMIN),
  [`${A}super-admin.ts#updateEventParticipantRole`]: superAdmin(SUPER_ADMIN),

  // --- route handlers -----------------------------------------------------
  [`${R}auth/[...nextauth]/route.ts#GET`]: {
    kind: "framework",
    reason: "NextAuth handles its own sign-in and session endpoints",
  },
  [`${R}auth/[...nextauth]/route.ts#POST`]: {
    kind: "framework",
    reason: "NextAuth handles its own sign-in and session endpoints",
  },
  [`${R}cron/rbac-reconcile/route.ts#GET`]: {
    kind: "secret",
    reason: "Bearer CRON_SECRET, fail closed when unset",
  },
  [`${R}cron/unlock/route.ts#GET`]: {
    kind: "secret",
    reason: "Bearer CRON_SECRET, fail closed when unset",
  },
  [`${R}events/invite/[inviteCode]/route.ts#GET`]: pub(
    "the invite code is the capability; returns the join card of the Event"
  ),
  [`${R}super-admin/check/route.ts#GET`]: pub(
    "reports whether the caller is a super admin (false when signed out)"
  ),
  [`${R}uploads/[...path]/route.ts#GET`]: read(
    "uploads are served by public URL (decision 4, docs/adr/0001); other files follow the read policy"
  ),
  [`${R}uptime/route.ts#GET`]: pub("health check; returns no data"),
  [`${R}runelite/docs/route.ts#GET`]: pub("static API documentation"),
  [`${R}runelite/auth/route.ts#POST`]: pub(
    "the API key in the body is the credential; returns the key owner's name"
  ),
  [`${R}runelite/keys/route.ts#GET`]: auth("the caller's own API keys"),
  [`${R}runelite/keys/route.ts#POST`]: auth(SELF),
  [`${R}runelite/keys/[id]/route.ts#DELETE`]: auth(
    "deletes only keys owned by the caller"
  ),
  [`${R}runelite/events/route.ts#GET`]: apiKey(
    "lists the Events of the API key's owner"
  ),
  [`${R}runelite/bingos/[bingoId]/route.ts#GET`]: apiKey(
    "participants and managers of the Event; drafts for managers",
    ["board:view-secret"]
  ),
  [`${R}runelite/items/check/route.ts#POST`]: apiKey(
    "only the Events the API key's owner takes part in"
  ),
  [`${R}runelite/team-drops/route.ts#GET`]: apiKey(
    "only the drops of the owner's own Teams"
  ),
  [`${R}runelite/team-tile-completions/route.ts#GET`]: apiKey(
    "only the completions of the owner's own Teams"
  ),
  [`${R}runelite/tiles/[tileId]/submissions/route.ts#POST`]: apiKey(
    "participants of the Tile's Event; managers for any Team",
    ["board:view-secret"]
  ),
  [`${R}runelite/tiles/[tileId]/auto-submissions/route.ts#POST`]: apiKey(
    "participants of the Tile's Event; managers for any Team",
    ["board:view-secret"]
  ),
  [`${R}submissions/[id]/comments/route.ts#GET`]: perm(
    "submission:read-comments",
    "enforced by requireSubmissionCommentReader: managers and the owning Team; everybody else gets 404"
  ),
  [`${R}submissions/[id]/comments/route.ts#POST`]: perm("submission:comment"),
}
