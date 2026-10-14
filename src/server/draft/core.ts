import "server-only"

import { randomInt } from "node:crypto"

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm"

import { can, type EventActor } from "@/lib/authz/policy"
import {
  identityPermutation,
  isPermutation,
  roundOf,
  seededPermutation,
  slotFor,
  totalPicks,
} from "@/lib/draft/order"
import { DRAFT_RATING_SOURCE, rateDraftPool } from "@/lib/draft/rating"
import type { DraftSettingsInput } from "@/lib/draft/setup"
import type {
  DraftEventPayloads,
  DraftEventType,
  DraftStatus,
} from "@/lib/draft/types"
import {
  failure,
  membershipFailure,
  type ActionFailure,
  type ActionResult,
} from "@/server/authz/guards"
import { recordEventAudit } from "@/server/authz/audit-log"
import {
  addTeamMembers,
  createDraftTeams,
  lockEventRow,
  onATeamAmong,
  participantsAmong,
  type Tx,
} from "@/server/authz/team-membership"
import {
  battleshipShips,
  draftEvents,
  draftPicks,
  draftPoolEntries,
  draftTeamSlots,
  drafts,
  eventParticipants,
  playerMetadata,
  teamGoalProgress,
  teamMembers,
  teamTierProgress,
  teamTileSubmissions,
  teams,
  type DraftRow,
} from "@/server/db/schema"

/**
 * The draft lifecycle, as plain functions that run in the caller's transaction
 * (`ctx.tx` of `eventAction`, or a test's own). The server actions in
 * `src/app/actions/draft.ts` authorize and call these; nothing here is
 * callable from the browser.
 *
 * Every mutation locks the draft row (`SELECT ... FOR UPDATE`) first, checks
 * its rules against rows read under that lock, writes the change and appends a
 * `draft_event` row in the same transaction. Status changes are
 * `UPDATE ... WHERE status = <expected>` with the affected rows counted. The
 * unique indexes on `(draft_id, pick_no)` and `(draft_id, pool_entry_id)` are
 * the backstop under that lock, not the primary guard.
 *
 * Refusals come back as `{ success: false, error, code }`. A function that
 * writes before it can still refuse (start, apply, cancel) runs its writes in
 * a savepoint (`atomic`), so a refusal leaves nothing behind even though the
 * surrounding transaction commits.
 */

export type { Tx }

type Result<T extends object = object> = ActionResult<T>

const NOT_FOUND = failure("Draft not found", "NOT_FOUND")

class AbortWith extends Error {
  constructor(readonly failure: ActionFailure) {
    super(failure.error)
  }
}

/** Runs `fn` in a savepoint; a returned failure rolls the savepoint back. */
async function atomic<T extends object>(
  tx: Tx,
  fn: (inner: Tx) => Promise<Result<T>>
): Promise<Result<T>> {
  try {
    return await tx.transaction(async (inner) => {
      const result = await fn(inner as Tx)
      if (!result.success) throw new AbortWith(result)
      return result
    })
  } catch (error) {
    if (error instanceof AbortWith) return error.failure
    throw error
  }
}

async function lockDraft(tx: Tx, draftId: string): Promise<DraftRow | null> {
  const [row] = await tx
    .select()
    .from(drafts)
    .where(eq(drafts.id, draftId))
    .for("update")
    .limit(1)
  return row ?? null
}

/** Appends a row to the draft log and returns its `seq`. */
export async function appendDraftEvent<T extends DraftEventType>(
  tx: Tx,
  draftId: string,
  type: T,
  actorUserId: string | null,
  payload: DraftEventPayloads[T]
): Promise<number> {
  const [row] = await tx
    .insert(draftEvents)
    .values({
      draftId,
      type,
      actorUserId,
      payload: payload as Record<string, unknown>,
    })
    .returning({ seq: draftEvents.seq })
  if (!row) throw new Error("draft_event insert returned no row")
  return row.seq
}

/**
 * Updates the locked draft, bumps `version` and `updated_at`, and only when it
 * still has the status it was read with. False: nothing was updated.
 */
type DraftUpdate = {
  [K in keyof typeof drafts.$inferInsert]?:
    | (typeof drafts.$inferInsert)[K]
    | SQL
}

async function updateDraft(
  tx: Tx,
  draft: Pick<DraftRow, "id" | "status">,
  set: DraftUpdate
): Promise<boolean> {
  const rows = await tx
    .update(drafts)
    .set({
      ...set,
      version: sql`${drafts.version} + 1`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(drafts.id, draft.id), eq(drafts.status, draft.status)))
    .returning({ id: drafts.id })
  return rows.length === 1
}

const CONFLICT_CHANGED = failure(
  "The draft changed while you were acting. Reload and try again.",
  "CONFLICT"
)

function statusMessage(status: DraftStatus): string {
  switch (status) {
    case "setup":
      return "The draft has not started yet"
    case "open":
      return "The draft has not started yet"
    case "paused":
      return "The draft is paused"
    case "complete":
      return "The draft is complete"
    case "cancelled":
      return "The draft was cancelled"
    default:
      return "The draft is not running"
  }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateDraftInput {
  eventId: string
  actor: Pick<EventActor, "userId">
  settings: DraftSettingsInput
}

/**
 * Creates a draft in `setup` with its captain slots. Teams are not created
 * until the draft starts. One non-cancelled draft per Event (the Event row is
 * locked, so two managers cannot race past the partial unique index).
 */
export async function createDraft(
  tx: Tx,
  input: CreateDraftInput
): Promise<Result<{ draftId: string }>> {
  const { settings } = input
  const captainIds = settings.captains.map((c) => c.userId)
  if (new Set(captainIds).size !== captainIds.length) {
    return failure("A player can only captain one team", "INVALID")
  }
  if (!(await lockEventRow(tx, input.eventId))) {
    return failure("Event not found", "NOT_FOUND")
  }

  const [existing] = await tx
    .select({ id: drafts.id })
    .from(drafts)
    .where(
      and(
        eq(drafts.eventId, input.eventId),
        sql`${drafts.status} <> 'cancelled'`
      )
    )
    .limit(1)
  if (existing) {
    return failure(
      "This event already has a draft. Cancel it to start another.",
      "CONFLICT"
    )
  }

  const participants = await participantsAmong(tx, input.eventId, captainIds)
  if (captainIds.some((id) => !participants.has(id))) {
    return failure(
      "Every captain must be a participant of the event",
      "INVALID"
    )
  }
  const onATeam = await onATeamAmong(tx, input.eventId, captainIds)
  if (onATeam.size > 0) {
    return failure("A captain is already on a team in this event", "CONFLICT")
  }

  const [draft] = await tx
    .insert(drafts)
    .values({
      eventId: input.eventId,
      orderType: settings.orderType,
      rounds: settings.rounds,
      pickTimerSeconds: settings.pickTimerSeconds,
      onTimeout: settings.onTimeout,
      autoPickRule: settings.autoPickRule,
      createdBy: input.actor.userId,
    })
    .returning({ id: drafts.id })
  if (!draft) throw new Error("draft insert returned no row")

  const maxTeamSize = settings.rounds + 1 // the captain plus one player per round
  const slots = await tx
    .insert(draftTeamSlots)
    .values(
      settings.captains.map((captain, position) => ({
        draftId: draft.id,
        eventId: input.eventId,
        captainUserId: captain.userId,
        teamName: captain.teamName,
        position,
        maxTeamSize,
      }))
    )
    .returning()

  await appendDraftEvent(tx, draft.id, "created", input.actor.userId, {
    orderType: settings.orderType,
    rounds: settings.rounds,
    pickTimerSeconds: settings.pickTimerSeconds,
    onTimeout: settings.onTimeout,
    autoPickRule: settings.autoPickRule,
    slots: slots
      .sort((a, b) => a.position - b.position)
      .map((slot) => ({
        slotId: slot.id,
        position: slot.position,
        captainUserId: slot.captainUserId,
        teamName: slot.teamName,
        maxTeamSize: slot.maxTeamSize,
      })),
  })
  return { success: true, draftId: draft.id }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

/**
 * Starts the draft: creates the Teams and the captains' memberships
 * (`createDraftTeams`), freezes the pool (every participant without a Team,
 * which by then excludes the captains), snapshots the ratings, stores the seed
 * and the resulting order, and moves the draft to `in_progress`.
 */
export async function startDraft(
  tx: Tx,
  input: { draftId: string; actor: Pick<EventActor, "userId"> }
): Promise<Result<{ poolSize: number; teams: number }>> {
  const draft = await lockDraft(tx, input.draftId)
  if (!draft) return NOT_FOUND
  if (draft.status !== "setup") {
    return failure(
      draft.status === "cancelled"
        ? statusMessage(draft.status)
        : "The draft has already started",
      "CONFLICT"
    )
  }

  const slots = await tx
    .select()
    .from(draftTeamSlots)
    .where(eq(draftTeamSlots.draftId, draft.id))
    .orderBy(asc(draftTeamSlots.position))
  if (slots.length < 2)
    return failure("A draft needs at least two captains", "INVALID")
  const captainIds = slots.map((s) => s.captainUserId)
  if (captainIds.some((id) => id === null)) {
    return failure("A captain's account no longer exists", "INVALID")
  }

  return atomic(tx, async (inner) => {
    const created = await createDraftTeams(inner, {
      eventId: draft.eventId,
      draftId: draft.id,
      actor: input.actor,
      source: "draft_start",
      teams: slots.map((slot) => ({
        name: slot.teamName,
        captainUserId: slot.captainUserId!,
      })),
    })
    if (!created.success) return membershipFailure(created)

    // Under the Event lock createDraftTeams took: everybody without a Team.
    const onATeam = inner
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(teams.eventId, draft.eventId))
    const poolUsers = await inner
      .select({ userId: eventParticipants.userId })
      .from(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, draft.eventId),
          notInArray(eventParticipants.userId, onATeam)
        )
      )
      .orderBy(asc(eventParticipants.createdAt), asc(eventParticipants.id))
    if (poolUsers.length === 0) {
      return failure("There are no players left to draft", "INVALID")
    }

    const metadata = await inner
      .select({
        userId: playerMetadata.userId,
        ehp: playerMetadata.ehp,
        ehb: playerMetadata.ehb,
        dailyHoursAvailable: playerMetadata.dailyHoursAvailable,
      })
      .from(playerMetadata)
      .where(
        and(
          eq(playerMetadata.eventId, draft.eventId),
          inArray(
            playerMetadata.userId,
            poolUsers.map((u) => u.userId)
          )
        )
      )
    const metadataOf = new Map(metadata.map((m) => [m.userId, m]))
    const ratings = new Map(
      rateDraftPool(
        poolUsers.map((u) => ({
          userId: u.userId,
          metadata: metadataOf.get(u.userId) ?? null,
        }))
      ).map((r) => [r.userId, r.rating])
    )

    const entries = await inner
      .insert(draftPoolEntries)
      .values(
        poolUsers.map((u) => ({
          draftId: draft.id,
          eventId: draft.eventId,
          userId: u.userId,
          ratingSnapshot: ratings.get(u.userId) ?? null,
          ratingSource: DRAFT_RATING_SOURCE,
        }))
      )
      .returning()

    const teamIdByCaptain = new Map(
      created.teams.map((t) => [t.captainUserId, t.teamId])
    )
    const slotTeams: { slotId: string; teamId: string }[] = []
    for (const slot of slots) {
      const teamId = teamIdByCaptain.get(slot.captainUserId!)!
      await inner
        .update(draftTeamSlots)
        .set({ teamId })
        .where(eq(draftTeamSlots.id, slot.id))
      slotTeams.push({ slotId: slot.id, teamId })
    }

    // The seed and the permutation it gives are both stored: the order stays
    // auditable whatever the PRNG implementation becomes.
    const seed = randomInt(1, 2 ** 32)
    const permutation =
      draft.orderType === "random_snake"
        ? seededPermutation(seed, slots.length)
        : identityPermutation(slots.length)

    // Phase 1 has no pick timer: `turn_deadline` stays NULL.
    const updated = await updateDraft(inner, draft, {
      status: "in_progress",
      seed,
      startedAt: sql`now()`,
    })
    if (!updated) return CONFLICT_CHANGED

    await appendDraftEvent(inner, draft.id, "started", input.actor.userId, {
      seed,
      permutation,
      slots: slotTeams,
      pool: entries.map((entry) => ({
        poolEntryId: entry.id,
        userId: entry.userId,
        rating: entry.ratingSnapshot,
        ratingSource: entry.ratingSource,
      })),
    })
    return { success: true, poolSize: entries.length, teams: slotTeams.length }
  })
}

// ---------------------------------------------------------------------------
// Pause / resume
// ---------------------------------------------------------------------------

async function changeStatus(
  tx: Tx,
  input: { draftId: string; actor: Pick<EventActor, "userId"> },
  from: DraftStatus,
  to: DraftStatus,
  type: "paused" | "resumed",
  refusal: string
): Promise<Result> {
  const draft = await lockDraft(tx, input.draftId)
  if (!draft) return NOT_FOUND
  if (draft.status !== from) return failure(refusal, "CONFLICT")
  if (!(await updateDraft(tx, draft, { status: to }))) return CONFLICT_CHANGED
  await appendDraftEvent(tx, draft.id, type, input.actor.userId, {})
  return { success: true }
}

export function pauseDraft(
  tx: Tx,
  input: { draftId: string; actor: Pick<EventActor, "userId"> }
): Promise<Result> {
  return changeStatus(
    tx,
    input,
    "in_progress",
    "paused",
    "paused",
    "Only a running draft can be paused"
  )
}

export function resumeDraft(
  tx: Tx,
  input: { draftId: string; actor: Pick<EventActor, "userId"> }
): Promise<Result> {
  return changeStatus(
    tx,
    input,
    "paused",
    "in_progress",
    "resumed",
    "Only a paused draft can be resumed"
  )
}

// ---------------------------------------------------------------------------
// Picks
// ---------------------------------------------------------------------------

export interface PerformPickInput {
  draftId: string
  poolEntryId: string
  actor: EventActor
  /** A manager picks for the captain whose turn it is (`forcePick`). */
  force?: boolean
}

async function loadPermutation(
  tx: Tx,
  draftId: string,
  slotCount: number
): Promise<number[]> {
  const [started] = await tx
    .select({ payload: draftEvents.payload })
    .from(draftEvents)
    .where(
      and(eq(draftEvents.draftId, draftId), eq(draftEvents.type, "started"))
    )
    .orderBy(asc(draftEvents.seq))
    .limit(1)
  const permutation = (
    started?.payload as { permutation?: unknown } | undefined
  )?.permutation
  if (!isPermutation(permutation, slotCount)) {
    throw new Error("The draft has no valid start event")
  }
  return permutation as number[]
}

/**
 * One pick, `makePick` or (with `force`) `forcePick`. In the caller's
 * transaction: lock the draft; work out the slot that is due from
 * `current_pick_no`; refuse unless the actor leads that slot's Team (or a
 * manager forces); refuse unless the player is an available pool entry and
 * still a participant; insert the pick, bump `current_pick_no` and `version`,
 * append the log row, and complete the draft after the last pick.
 */
export async function performPick(
  tx: Tx,
  input: PerformPickInput
): Promise<Result<{ pickNo: number; completed: boolean }>> {
  const draft = await lockDraft(tx, input.draftId)
  if (!draft) return NOT_FOUND
  if (draft.status !== "in_progress") {
    return failure(statusMessage(draft.status), "CONFLICT")
  }

  const slots = await tx
    .select()
    .from(draftTeamSlots)
    .where(eq(draftTeamSlots.draftId, draft.id))
    .orderBy(asc(draftTeamSlots.position))
  const permutation = await loadPermutation(tx, draft.id, slots.length)
  const pickNo = draft.currentPickNo
  const slot =
    slots[slotFor(pickNo, slots.length, draft.orderType, permutation)]
  if (!slot) throw new Error("No slot for the current pick")

  if (input.force) {
    if (!can(input.actor, "draft:manage")) {
      return failure("Forbidden: insufficient permissions", "FORBIDDEN")
    }
  } else if (
    !slot.teamId ||
    !can(input.actor, "draft:pick", { teamId: slot.teamId })
  ) {
    const isCaptain = slots.some(
      (s) => s.teamId && can(input.actor, "draft:pick", { teamId: s.teamId })
    )
    return isCaptain
      ? failure("It is not your turn", "CONFLICT")
      : failure("Only a captain can pick", "FORBIDDEN")
  }

  const [entry] = await tx
    .select()
    .from(draftPoolEntries)
    .where(
      and(
        eq(draftPoolEntries.id, input.poolEntryId),
        eq(draftPoolEntries.draftId, draft.id)
      )
    )
    .limit(1)
  if (!entry) return failure("Player not found in this draft", "NOT_FOUND")
  if (entry.status !== "available") {
    return failure("That player is not available", "CONFLICT")
  }
  if (entry.userId) {
    const stillIn = await participantsAmong(tx, draft.eventId, [entry.userId])
    if (!stillIn.has(entry.userId)) {
      return failure("That player has left the event", "CONFLICT")
    }
  }

  const [{ n: slotPicks = 0 } = {}] = await tx
    .select({ n: count() })
    .from(draftPicks)
    .where(
      and(eq(draftPicks.draftId, draft.id), eq(draftPicks.slotId, slot.id))
    )
  // The captain counts toward the team size.
  if (slotPicks + 1 >= slot.maxTeamSize) {
    return failure("That team is already full", "CONFLICT")
  }

  await tx.insert(draftPicks).values({
    draftId: draft.id,
    pickNo,
    round: roundOf(pickNo, slots.length),
    slotId: slot.id,
    poolEntryId: entry.id,
    pickedBy: input.actor.userId,
    auto: false,
    reason: input.force ? "forced" : null,
  })
  await tx
    .update(draftPoolEntries)
    .set({ status: "drafted" })
    .where(eq(draftPoolEntries.id, entry.id))

  const [{ n: available = 0 } = {}] = await tx
    .select({ n: count() })
    .from(draftPoolEntries)
    .where(
      and(
        eq(draftPoolEntries.draftId, draft.id),
        eq(draftPoolEntries.status, "available")
      )
    )
  const nextPickNo = pickNo + 1
  const completed =
    nextPickNo > totalPicks(draft.rounds, slots.length) || available === 0

  const updated = await updateDraft(tx, draft, {
    currentPickNo: nextPickNo,
    ...(completed ? { status: "complete", completedAt: sql`now()` } : {}),
  })
  if (!updated) throw new Error("The locked draft changed under the pick")

  await appendDraftEvent(tx, draft.id, "pick", input.actor.userId, {
    pickNo,
    round: roundOf(pickNo, slots.length),
    slotId: slot.id,
    poolEntryId: entry.id,
    userId: entry.userId,
    auto: false,
    forced: input.force === true,
    reason: input.force ? "forced" : null,
  })
  if (completed) {
    await appendDraftEvent(tx, draft.id, "completed", input.actor.userId, {})
  }
  return { success: true, pickNo, completed }
}

/**
 * Removes the last pick (manager only, enforced by the action's permission).
 * Pick numbers stay contiguous because only the highest one is removed under
 * the draft lock. A completed draft that was not applied becomes
 * `in_progress` again.
 */
export async function undoPick(
  tx: Tx,
  input: { draftId: string; actor: Pick<EventActor, "userId"> }
): Promise<Result<{ pickNo: number }>> {
  const draft = await lockDraft(tx, input.draftId)
  if (!draft) return NOT_FOUND
  if (draft.appliedAt) {
    return failure("The teams were already applied", "CONFLICT")
  }
  if (!["in_progress", "paused", "complete"].includes(draft.status)) {
    return failure(statusMessage(draft.status), "CONFLICT")
  }

  const [last] = await tx
    .select()
    .from(draftPicks)
    .where(eq(draftPicks.draftId, draft.id))
    .orderBy(desc(draftPicks.pickNo))
    .limit(1)
  if (!last) return failure("There is no pick to undo", "CONFLICT")

  await tx.delete(draftPicks).where(eq(draftPicks.id, last.id))
  await tx
    .update(draftPoolEntries)
    .set({ status: "available" })
    .where(eq(draftPoolEntries.id, last.poolEntryId))
  const reopen = draft.status === "complete"
  const updated = await updateDraft(tx, draft, {
    currentPickNo: last.pickNo,
    ...(reopen ? { status: "in_progress", completedAt: null } : {}),
  })
  if (!updated) throw new Error("The locked draft changed under the undo")

  await appendDraftEvent(tx, draft.id, "undo", input.actor.userId, {
    pickNo: last.pickNo,
    slotId: last.slotId,
    poolEntryId: last.poolEntryId,
  })
  return { success: true, pickNo: last.pickNo }
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/**
 * The manager's confirmation: writes the drafted players to `team_members`
 * (through `addTeamMembers`, with `event_id` set) and marks the draft applied.
 * Requires a complete draft that was not applied. Players who left the Event
 * since the pool snapshot are reported, not fatal; a player who is already on
 * a Team of the Event refuses the whole apply. Leftover pool players stay
 * unassigned.
 */
export async function applyDraft(
  tx: Tx,
  input: { draftId: string; actor: Pick<EventActor, "userId"> }
): Promise<Result<{ applied: number; skippedUserIds: string[] }>> {
  const draft = await lockDraft(tx, input.draftId)
  if (!draft) return NOT_FOUND
  if (draft.appliedAt) {
    return failure("The teams were already applied", "CONFLICT")
  }
  if (draft.status !== "complete") {
    return failure("Only a complete draft can be applied", "CONFLICT")
  }

  const slots = await tx
    .select()
    .from(draftTeamSlots)
    .where(eq(draftTeamSlots.draftId, draft.id))
    .orderBy(asc(draftTeamSlots.position))
  const picks = await tx
    .select({ slotId: draftPicks.slotId, userId: draftPoolEntries.userId })
    .from(draftPicks)
    .innerJoin(
      draftPoolEntries,
      and(
        eq(draftPoolEntries.id, draftPicks.poolEntryId),
        eq(draftPoolEntries.draftId, draftPicks.draftId)
      )
    )
    .where(eq(draftPicks.draftId, draft.id))
    .orderBy(asc(draftPicks.pickNo))

  return atomic(tx, async (inner) => {
    const applied: string[] = []
    const skipped: string[] = []
    for (const slot of slots) {
      // A player whose account is gone has no id left to add.
      const userIds = picks
        .filter((p) => p.slotId === slot.id && p.userId !== null)
        .map((p) => p.userId!)
      if (userIds.length === 0) continue
      if (!slot.teamId) {
        return failure(
          `The team "${slot.teamName}" no longer exists, so its players cannot be applied`,
          "CONFLICT"
        )
      }
      const result = await addTeamMembers(inner, {
        eventId: draft.eventId,
        teamId: slot.teamId,
        userIds,
        actor: input.actor,
        source: "draft_apply",
        draftId: draft.id,
        skipMissing: true,
      })
      if (!result.success) return membershipFailure(result)
      applied.push(...result.added)
      skipped.push(...result.skipped.map((s) => s.userId))
    }

    const updated = await updateDraft(inner, draft, { appliedAt: sql`now()` })
    if (!updated) return CONFLICT_CHANGED
    await appendDraftEvent(inner, draft.id, "applied", input.actor.userId, {
      applied,
      skipped,
    })
    return { success: true, applied: applied.length, skippedUserIds: skipped }
  })
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

/**
 * Cancels the draft. The Teams it created are deleted when they hold nothing
 * but their captain and have no progress (tile submissions, goal or tier
 * progress, battleship ships); a Team with more is kept, captain included.
 * Not possible once the teams were applied.
 */
export async function cancelDraft(
  tx: Tx,
  input: { draftId: string; actor: Pick<EventActor, "userId"> }
): Promise<Result<{ deletedTeams: number; keptTeams: number }>> {
  const draft = await lockDraft(tx, input.draftId)
  if (!draft) return NOT_FOUND
  if (draft.status === "cancelled") {
    return failure("The draft was already cancelled", "CONFLICT")
  }
  if (draft.appliedAt) {
    return failure("The teams were already applied", "CONFLICT")
  }

  const slots = await tx
    .select()
    .from(draftTeamSlots)
    .where(eq(draftTeamSlots.draftId, draft.id))
  const deletable: string[] = []
  const kept: string[] = []
  for (const slot of slots) {
    if (!slot.teamId) continue
    const members = await tx
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, slot.teamId))
    const onlyCaptain = members.every((m) => m.userId === slot.captainUserId)
    if (onlyCaptain && !(await teamHasProgress(tx, slot.teamId))) {
      deletable.push(slot.teamId)
    } else {
      kept.push(slot.teamId)
    }
  }

  if (!(await updateDraft(tx, draft, { status: "cancelled" }))) {
    return CONFLICT_CHANGED
  }
  if (deletable.length > 0) {
    await tx.delete(teams).where(inArray(teams.id, deletable))
  }
  await appendDraftEvent(tx, draft.id, "cancelled", input.actor.userId, {
    deletedTeamIds: deletable,
    keptTeamIds: kept,
  })
  await recordEventAudit(tx, {
    eventId: draft.eventId,
    actorUserId: input.actor.userId,
    action: "draft.cancel",
    permission: "draft:manage",
    targetType: "draft",
    targetId: draft.id,
    outcome: "success",
    before: { status: draft.status },
    after: {
      status: "cancelled",
      deletedTeamIds: deletable,
      keptTeamIds: kept,
    },
    reason: null,
  })
  return {
    success: true,
    deletedTeams: deletable.length,
    keptTeams: kept.length,
  }
}

async function teamHasProgress(tx: Tx, teamId: string): Promise<boolean> {
  const tables = [
    [teamTileSubmissions, teamTileSubmissions.teamId],
    [teamGoalProgress, teamGoalProgress.teamId],
    [teamTierProgress, teamTierProgress.teamId],
    [battleshipShips, battleshipShips.teamId],
  ] as const
  for (const [table, column] of tables) {
    const [row] = await tx
      .select({ id: column })
      .from(table)
      .where(eq(column, teamId))
      .limit(1)
    if (row) return true
  }
  return false
}
