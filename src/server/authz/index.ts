/**
 * Server-side authorization for Events.
 *
 * - `actor.ts`   one cached lookup of the caller's standing in an Event
 * - `guards.ts`  `authorize` / `requirePermission` and the existing
 *                `require*` helpers
 * - `resolve.ts` Event from Board / Tile / Goal / Submission / Team
 * - `compat.ts`  existing Team / comment / Tile-readability helpers
 *
 * The pure policy lives in `@/lib/authz`. `eventAction` (next-safe-action) is
 * imported from `@/server/authz/action` so this entry point stays light.
 * This is intentionally not a "use server" module.
 */
export { AuthzError, authzErrorMessage, type AuthzErrorCode } from "./errors"
export { getEventActor, getEventRole, type EventActorLookup } from "./actor"
export {
  authorize,
  isEventManager,
  requireEventAdmin,
  requireEventManager,
  requireEventMember,
  requirePermission,
  requireSession,
  type AuthorizeResult,
} from "./guards"
export {
  assertGoalInEvent,
  eventIdOfBingo,
  eventIdOfGoal,
  eventIdOfGoalGroup,
  eventIdOfGoalValue,
  eventIdOfSubmission,
  eventIdOfTeam,
  eventIdOfTeamTileSubmission,
  eventIdOfTile,
  requireBingoAdmin,
  requireBingoAdminForGoal,
  requireBingoAdminForGoalGroup,
  requireBingoAdminForGoalValue,
  requireBingoAdminForSubmission,
  requireBingoAdminForTeamTileSubmission,
  requireBingoAdminForTile,
} from "./resolve"
export {
  assertTeamLeaderOrManager,
  canReadGoal,
  canReadTile,
  requireSubmissionCommentReader,
  requireTeamMemberOrManager,
} from "./compat"
