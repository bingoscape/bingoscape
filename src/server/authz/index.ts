/**
 * Server-side authorization for Events.
 *
 * - `actor.ts`   one cached lookup of the caller's standing in an Event
 * - `capabilities.ts` cached `getEventCapabilities` for the UI
 * - `guards.ts`  `authorize` / `requirePermission` / `hasPermission`, the
 *                action result helpers and the return conventions
 * - `api.ts`     `getApiActor` for the RuneLite routes
 * - `registry.ts` every action and route handler with its policy
 * - `resolve.ts` Event from Board / Tile / Goal / Submission / Team, and
 *                `requirePermissionFor<Resource>`
 * - `read.ts`    read policy: canReadEvent / Board / Tile / Team
 * - `compat.ts`  Team and Submission comment guards
 *
 * The pure policy lives in `@/lib/authz`. `eventAction` (next-safe-action) is
 * imported from `@/server/authz/action` so this entry point stays light.
 * This is intentionally not a "use server" module.
 */
export { AuthzError, authzErrorMessage, type AuthzErrorCode } from "./errors"
export { getEventActor, getEventRole, type EventActorLookup } from "./actor"
export { getEventCapabilities } from "./capabilities"
export {
  actionFailure,
  authorize,
  denial,
  failure,
  hasPermission,
  membershipFailure,
  requirePermission,
  requireSession,
  type ActionErrorCode,
  type ActionFailure,
  type ActionResult,
  type AuthorizeResult,
} from "./guards"
export { getApiActor, type ApiActorLookup } from "./api"
export {
  assertGoalInEvent,
  eventIdOfBingo,
  eventIdOfGoal,
  eventIdOfGoalGroup,
  eventIdOfGoalValue,
  eventIdOfRegistrationRequest,
  eventIdOfSubmission,
  eventIdOfTeam,
  eventIdOfTeamTileSubmission,
  eventIdOfTile,
  eventIdOfWebhook,
  requirePermissionForBingo,
  requirePermissionForEvent,
  requirePermissionForGoal,
  requirePermissionForGoalGroup,
  requirePermissionForGoalValue,
  requirePermissionForRegistrationRequest,
  requirePermissionForSubmission,
  requirePermissionForTeam,
  requirePermissionForTeamTileSubmission,
  requirePermissionForTile,
  requirePermissionForWebhook,
} from "./resolve"
export {
  assertTeamLeaderOrManager,
  requireSubmissionCommentReader,
  requireTeamMemberOrManager,
} from "./compat"
export {
  canReadBoard,
  canReadEvent,
  canReadGoal,
  canReadTeam,
  canReadTile,
  getBoardReadAccess,
  getEventReadAccess,
  getEventReadAccessFor,
  getReadPolicyMode,
  getTileReadAccess,
  keepViewerTeamProgress,
  redactBoardForViewer,
  type BoardReadAccess,
  type EventReadAccess,
} from "./read"
