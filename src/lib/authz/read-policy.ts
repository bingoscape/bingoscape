import { can, type EventActor } from "./policy"

/**
 * Pure read policy: who may read what of an Event (Event, Board, Tile, Team).
 * It is built on `can()` and has no I/O; the server side (session, database,
 * blind-Board clock) lives in `@/server/authz/read`. Safe to import anywhere.
 *
 * Vocabulary
 *
 * - A **read level** says how the viewer stands towards the Event:
 *   `manager` (admin / management; the creator is an admin), `member` (any other participant,
 *   or a member of one of its Teams), `public` (not a member, but the Event is
 *   public), `summary` (a signed-in non-member of a non-public Event: they hold
 *   the link and get the join card), `none`.
 * - A **read scope** says what kind of data is asked for: `summary` (title,
 *   dates, registration state), `content` (visible Boards, Tiles, Goals and the
 *   leaderboard: what the public Event page shows) and `member-data` (per
 *   player and per Submission data: statistics, Submissions, images).
 *
 * Everything that is not about reading *whether* the viewer may look (what is
 * redacted inside a Board: hidden Tiles, Blind Tiles, secrets) is decided by the
 * existing helpers in `hidden-tiles.ts`, `blind-board.ts` and
 * `battleship-privacy.ts`; this module only supplies their inputs.
 */

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

/**
 * `enforce`: the policy below applies. `relaxed`: the escape hatch for the
 * roll-out. A non-member is then read like a participant for the *content*
 * gates, which is what the reads allowed before the policy existed. Managers'
 * data, redaction of hidden / Blind Tiles, battleship privacy and the secrets
 * (tracker verification code, codephrase) are never relaxed.
 */
export type ReadPolicyMode = "enforce" | "relaxed"

/** Environment variable read at request time (no redeploy to change it). */
export const READ_POLICY_ENV_VAR = "RBAC_READ_POLICY"

export const DEFAULT_READ_POLICY_MODE: ReadPolicyMode = "enforce"

/** Unknown, empty or missing values mean the default (fail closed). */
export function parseReadPolicyMode(
  value: string | null | undefined
): ReadPolicyMode {
  const normalized = value?.trim().toLowerCase()
  return normalized === "relaxed" || normalized === "enforce"
    ? normalized
    : DEFAULT_READ_POLICY_MODE
}

// ---------------------------------------------------------------------------
// Decisions 3-5 of the RBAC epic (#183)
// ---------------------------------------------------------------------------

export interface ReadDecisions {
  /**
   * Decision 3. What a signed-in non-member gets from a non-public Event.
   * `link-holders`: the join card (title, dates, registration state), as the
   * Event page shows today. `members-only`: nothing, the Event does not exist
   * for them (they can still join through an invite code).
   */
  nonPublicEventForNonMembers: "link-holders" | "members-only"
  /**
   * Decision 4. Who may fetch a Submission image from `/api/uploads`.
   * `follow-event-visibility` (decided): only those who may see the Submission.
   * `public-url`: anybody holding the (unguessable) URL, cached for a year, as
   * before the read policy existed.
   */
  uploads: "public-url" | "follow-event-visibility"
  /**
   * Decision 5. Who sees a Board's codephrase. `players`: managers and the
   * Event's participants, as today. `managers`: managers only.
   */
  codephrase: "players" | "managers"
}

/**
 * Defaults pending maintainer confirmation: each one is what the application
 * did before this policy existed. Changing a value here is the whole change
 * (see docs/adr/0001-read-visibility-defaults.md).
 */
export const READ_DECISIONS: ReadDecisions = {
  nonPublicEventForNonMembers: "link-holders",
  uploads: "follow-event-visibility",
  codephrase: "players",
}

export interface ReadPolicyOptions {
  mode?: ReadPolicyMode
  decisions?: ReadDecisions
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export type EventReadLevel =
  | "manager"
  | "member"
  | "public"
  | "summary"
  | "none"

export type EventReadScope = "summary" | "content" | "member-data"

export interface EventReadFacts {
  /** The viewer's standing in the Event; null when signed out. */
  actor: EventActor | null
  /** Whether a session exists at all (an actor needs the Event to exist). */
  signedIn: boolean
  eventPublic: boolean
}

/** How the viewer stands towards the Event. Managers are never downgraded. */
export function eventReadLevel(
  facts: EventReadFacts,
  options: ReadPolicyOptions = {}
): EventReadLevel {
  const { mode = DEFAULT_READ_POLICY_MODE, decisions = READ_DECISIONS } =
    options
  const { actor } = facts

  if (can(actor, "board:view-secret")) return "manager"
  if (can(actor, "event:view") || (actor && actor.teams.length > 0)) {
    return "member"
  }

  if (mode === "relaxed") return "member"
  if (facts.eventPublic) return "public"
  if (
    facts.signedIn &&
    decisions.nonPublicEventForNonMembers === "link-holders"
  ) {
    return "summary"
  }
  return "none"
}

const LEVEL_SCOPES: Record<EventReadLevel, readonly EventReadScope[]> = {
  manager: ["summary", "content", "member-data"],
  member: ["summary", "content", "member-data"],
  public: ["summary", "content"],
  summary: ["summary"],
  none: [],
}

export function levelAllows(
  level: EventReadLevel,
  scope: EventReadScope
): boolean {
  return LEVEL_SCOPES[level].includes(scope)
}

// ---------------------------------------------------------------------------
// Board, Tile, Team
// ---------------------------------------------------------------------------

/**
 * A Board that is not `visible` is a draft: managers only. Otherwise the
 * viewer needs the scope on the Event.
 */
export function boardReadable(
  level: EventReadLevel,
  scope: EventReadScope,
  board: { visible: boolean }
): boolean {
  if (!levelAllows(level, scope)) return false
  return level === "manager" || board.visible
}

/**
 * Whether the content of one Tile (title, Goals, progress, Submissions) may be
 * read. A hidden Tile and a Tile of a Blind Board (`blind`, from
 * `isBlindBoard`) keep their cell but are readable by managers only.
 */
export function tileContentReadable(
  level: EventReadLevel,
  board: { visible: boolean },
  tile: { isHidden: boolean },
  blind: boolean
): boolean {
  if (!boardReadable(level, "content", board)) return false
  if (level === "manager") return true
  return !tile.isHidden && !blind
}

export type TeamReadScope = "summary" | "records"

/**
 * `summary`: the Team's name and place on the leaderboard, for everybody who
 * may read the Event content. `records`: its progress and Submissions. Managers
 * and the Team's own members always may; other participants may on a standard
 * or progression Board but never on a battleship Board, where the opponent's
 * completions would give away what was hit (see `battleship-privacy.ts`).
 */
export function teamReadable(
  actor: EventActor | null,
  level: EventReadLevel,
  scope: TeamReadScope,
  team: { teamId: string },
  board: { isBattleship: boolean } = { isBattleship: false }
): boolean {
  if (scope === "summary") return levelAllows(level, "content")
  if (level === "manager" || can(actor, "team:access", team)) return true
  return levelAllows(level, "member-data") && !board.isBattleship
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

/** Whether the viewer sees the Board's codephrase (decision 5). */
export function codephraseVisible(
  level: EventReadLevel,
  decisions: ReadDecisions = READ_DECISIONS
): boolean {
  if (level === "manager") return true
  return level === "member" && decisions.codephrase === "players"
}

interface BoardSecrets {
  codephrase: string
  womCompetitionId: number | null
  womVerificationCode: string | null
}

/**
 * Removes what the viewer must not see from a Board row. The tracker
 * verification code lets its holder edit the competition, so it is for
 * managers only; the codephrase follows decision 5. Pass the *strict* level
 * (the one `enforce` would give), so the relaxed mode never leaks a secret.
 */
export function redactBoardSecrets<T extends BoardSecrets>(
  board: T,
  strictLevel: EventReadLevel,
  decisions: ReadDecisions = READ_DECISIONS
): T {
  const manager = strictLevel === "manager"
  const participant = manager || strictLevel === "member"
  return {
    ...board,
    codephrase: codephraseVisible(strictLevel, decisions)
      ? board.codephrase
      : "",
    womCompetitionId: participant ? board.womCompetitionId : null,
    womVerificationCode: manager ? board.womVerificationCode : null,
  }
}
