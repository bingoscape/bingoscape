import "server-only"

import { randomInt } from "node:crypto"

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  notInArray,
  sql,
} from "drizzle-orm"

import { can, type EventActor } from "@/lib/authz/policy"
import { identityPermutation, seededPermutation } from "@/lib/draft/order"
import { normalizeQueue } from "@/lib/draft/autopick"
import { DRAFT_RATING_SOURCE, rateDraftPool } from "@/lib/draft/rating"
import type { DraftSettingsInput } from "@/lib/draft/setup"
import { failure, membershipFailure } from "@/server/authz/guards"
import { recordEventAudit } from "@/server/authz/audit-log"
import {
  addTeamMembers,
  createDraftTeams,
  lockEventRow,
  onATeamAmong,
  participantsAmong,
} from "@/server/authz/team-membership"
import {
  battleshipShips,
  draftPicks,
  draftPoolEntries,
  draftQueueEntries,
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
import { expireLocked } from "./expire"
import {
  CONFLICT_CHANGED,
  NOT_FOUND,
  appendDraftEvent,
  atomic,
  deadlineIn,
  deadlineInMs,
  lockDraft,
  remainingMsSql,
  statusMessage,
  timerPayload,
  updateDraft,
  type Result,
  type Tx,
} from "./internal"
import {
  commitPick,
  commitSkip,
  isFull,
  loadTurn,
  pickCounts,
  slotAt,
} from "./turn"

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
export { appendDraftEvent }

/**
 * One `event_audit_log` row per manager action (team draft 4/4, #218), in the
 * transaction of the change it records. The draft's own log (`draft_event`)
 * says what happened in the draft; this says who as a manager did it, in the
 * place the rest of the Event's sensitive changes are found. Cancel logs its
 * own row (it records the Teams it deleted).
 */
async function auditManagerAction(
  tx: Tx,
  draft: Pick<DraftRow, "id" | "eventId">,
  actor: Pick<EventActor, "userId">,
  action:
    | "draft.start"
    | "draft.pause"
    | "draft.resume"
    | "draft.skip_turn"
    | "draft.force_pick"
    | "draft.undo"
    | "draft.apply",
  change: {
    before?: Record<string, unknown> | null
    after?: Record<string, unknown> | null
  }
): Promise<void> {
  await recordEventAudit(tx, {
    eventId: draft.eventId,
    actorUserId: actor.userId,
    action,
    permission: "draft:manage",
    targetType: "draft",
    targetId: draft.id,
    outcome: "success",
    before: change.before ?? null,
    after: change.after ?? null,
    reason: null,
  })
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

  // The captain plus one player per round, unless the manager capped it.
  const maxTeamSize = settings.maxTeamSize ?? settings.rounds + 1
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

    const seconds = draft.pickTimerSeconds
    const timing = await updateDraft(inner, draft, {
      status: "in_progress",
      seed,
      startedAt: sql`now()`,
      turnDeadline: seconds ? deadlineIn(seconds) : null,
    })
    if (!timing) return CONFLICT_CHANGED

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
      ...timerPayload(timing),
    })
    await auditManagerAction(inner, draft, input.actor, "draft.start", {
      before: { status: draft.status },
      after: {
        status: "in_progress",
        poolSize: entries.length,
        teams: slotTeams.length,
        orderType: draft.orderType,
        rounds: draft.rounds,
      },
    })
    return { success: true, poolSize: entries.length, teams: slotTeams.length }
  })
}

// ---------------------------------------------------------------------------
// Pause / resume
// ---------------------------------------------------------------------------

/**
 * Pauses the running draft and freezes the time left on the turn
 * (`paused_remaining_ms`); `resumeDraft` restores it. A turn that had already
 * run out is resolved first (it is the timer's, not the manager's, to settle).
 */
export async function pauseDraft(
  tx: Tx,
  input: { draftId: string; actor: Pick<EventActor, "userId"> }
): Promise<Result> {
  const locked = await lockDraft(tx, input.draftId)
  if (!locked) return NOT_FOUND
  const { draft } = await expireLocked(tx, locked)
  if (draft.status !== "in_progress") {
    return failure("Only a running draft can be paused", "CONFLICT")
  }
  const timing = await updateDraft(tx, draft, {
    status: "paused",
    turnDeadline: null,
    pausedRemainingMs: draft.turnDeadline ? remainingMsSql : null,
  })
  if (!timing) return CONFLICT_CHANGED
  await appendDraftEvent(tx, draft.id, "paused", input.actor.userId, {
    reason: "manual",
    ...timerPayload(timing),
  })
  await auditManagerAction(tx, draft, input.actor, "draft.pause", {
    before: { status: "in_progress" },
    after: { status: "paused" },
  })
  return { success: true }
}

export async function resumeDraft(
  tx: Tx,
  input: { draftId: string; actor: Pick<EventActor, "userId"> }
): Promise<Result> {
  const draft = await lockDraft(tx, input.draftId)
  if (!draft) return NOT_FOUND
  if (draft.status !== "paused") {
    return failure("Only a paused draft can be resumed", "CONFLICT")
  }
  const seconds = draft.pickTimerSeconds
  // A draft paused before the timer existed has no stored time: start over.
  const remainingMs =
    draft.pausedRemainingMs ?? (seconds ? seconds * 1000 : null)
  const timing = await updateDraft(tx, draft, {
    status: "in_progress",
    turnDeadline: remainingMs === null ? null : deadlineInMs(remainingMs),
    pausedRemainingMs: null,
  })
  if (!timing) return CONFLICT_CHANGED
  await appendDraftEvent(
    tx,
    draft.id,
    "resumed",
    input.actor.userId,
    timerPayload(timing)
  )
  await auditManagerAction(tx, draft, input.actor, "draft.resume", {
    before: { status: "paused" },
    after: { status: "in_progress" },
  })
  return { success: true }
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

const TURN_EXPIRED = failure(
  "Time ran out for that turn, so the draft moved on",
  "CONFLICT"
)

/**
 * One pick, `makePick` or (with `force`) `forcePick`. In the caller's
 * transaction: lock the draft; settle an expired turn (a pick that arrives
 * after the deadline loses to the timer); work out the slot that is due from
 * `current_pick_no`; refuse unless the actor leads that slot's Team (or a
 * manager forces); refuse unless the player is an available pool entry and
 * still a participant; then record the pick and move the turn on
 * (`commitPick`: next deadline, completion, full teams passed over).
 */
export async function performPick(
  tx: Tx,
  input: PerformPickInput
): Promise<Result<{ pickNo: number; completed: boolean }>> {
  const locked = await lockDraft(tx, input.draftId)
  if (!locked) return NOT_FOUND
  const { draft, acted } = await expireLocked(tx, locked)
  if (acted) return TURN_EXPIRED
  if (draft.status !== "in_progress") {
    return failure(statusMessage(draft.status), "CONFLICT")
  }

  const ctx = await loadTurn(tx, draft)
  const { slots } = ctx
  const pickNo = draft.currentPickNo
  const slot = slotAt(ctx, pickNo)

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

  const counts = await pickCounts(tx, draft.id)
  if (isFull(slot, counts.get(slot.id) ?? 0)) {
    return failure("That team is already full", "CONFLICT")
  }

  const picked = await commitPick(tx, ctx, {
    pickNo,
    slot,
    entry,
    actorUserId: input.actor.userId,
    auto: false,
    reason: input.force ? "forced" : null,
    // The captain picked: their streak of timeouts ends. A manager picking for
    // an absent captain does not end it.
    consecutiveTimeouts: input.force ? slot.consecutiveTimeouts : 0,
  })
  if (input.force && picked.success) {
    await auditManagerAction(tx, draft, input.actor, "draft.force_pick", {
      after: {
        pickNo,
        slotId: slot.id,
        teamName: slot.teamName,
        poolEntryId: entry.id,
        userId: entry.userId,
      },
    })
  }
  return picked
}

/**
 * A manager passes the on-turn captain's pick (`skipTurn`): the pick is lost,
 * as with `on_timeout: skip`, and the next turn starts with a fresh deadline.
 */
export async function skipTurn(
  tx: Tx,
  input: { draftId: string; actor: Pick<EventActor, "userId"> }
): Promise<Result<{ pickNo: number; completed: boolean }>> {
  const locked = await lockDraft(tx, input.draftId)
  if (!locked) return NOT_FOUND
  const { draft, acted } = await expireLocked(tx, locked)
  if (acted) return TURN_EXPIRED
  if (draft.status !== "in_progress") {
    return failure(statusMessage(draft.status), "CONFLICT")
  }
  const ctx = await loadTurn(tx, draft)
  const pickNo = draft.currentPickNo
  const slot = slotAt(ctx, pickNo)
  const skipped = await commitSkip(tx, ctx, {
    pickNo,
    slot,
    actorUserId: input.actor.userId,
    reason: "manual_skip",
    consecutiveTimeouts: slot.consecutiveTimeouts,
  })
  if (skipped.success) {
    await auditManagerAction(tx, draft, input.actor, "draft.skip_turn", {
      after: { pickNo, slotId: slot.id, teamName: slot.teamName },
    })
  }
  return skipped
}

/**
 * Sets the viewer's pick queue: the players their team takes first when the
 * timer runs out. Only a captain, only for their own team, only players still
 * available; the list replaces the old one. Private: it is not logged and not
 * part of any snapshot.
 */
export async function setPickQueue(
  tx: Tx,
  input: { draftId: string; actor: EventActor; poolEntryIds: string[] }
): Promise<Result<{ count: number }>> {
  const draft = await lockDraft(tx, input.draftId)
  if (!draft) return NOT_FOUND
  if (draft.status !== "in_progress" && draft.status !== "paused") {
    return failure(statusMessage(draft.status), "CONFLICT")
  }
  const slots = await tx
    .select()
    .from(draftTeamSlots)
    .where(eq(draftTeamSlots.draftId, draft.id))
  const slot = slots.find(
    (s) => s.teamId && can(input.actor, "draft:pick", { teamId: s.teamId })
  )
  if (!slot) {
    return failure("Only a captain can queue players", "FORBIDDEN")
  }

  const available = await tx
    .select({ id: draftPoolEntries.id })
    .from(draftPoolEntries)
    .where(
      and(
        eq(draftPoolEntries.draftId, draft.id),
        eq(draftPoolEntries.status, "available")
      )
    )
  const queue = normalizeQueue(
    input.poolEntryIds,
    new Set(available.map((e) => e.id))
  )

  await tx
    .delete(draftQueueEntries)
    .where(eq(draftQueueEntries.slotId, slot.id))
  if (queue.length > 0) {
    await tx.insert(draftQueueEntries).values(
      queue.map((poolEntryId, position) => ({
        draftId: draft.id,
        slotId: slot.id,
        poolEntryId,
        position,
      }))
    )
  }
  return { success: true, count: queue.length }
}

/**
 * Removes the last pick (manager only, enforced by the action's permission).
 * It is a soft delete (`undone_at`): the row stays for the audit trail, and
 * the unique indexes ignore it, so its pick number and its player are free
 * again. Pick numbers stay contiguous because only the highest standing one is
 * undone under the draft lock; the order is never recomputed. A completed
 * draft that was not applied becomes `in_progress` again; the turn restarts
 * with a full timer.
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
    .where(and(eq(draftPicks.draftId, draft.id), isNull(draftPicks.undoneAt)))
    .orderBy(desc(draftPicks.pickNo))
    .limit(1)
  if (!last) return failure("There is no pick to undo", "CONFLICT")

  await tx
    .update(draftPicks)
    .set({ undoneAt: sql`now()` })
    .where(eq(draftPicks.id, last.id))
  await tx
    .update(draftPoolEntries)
    .set({ status: "available" })
    .where(eq(draftPoolEntries.id, last.poolEntryId))

  // A pick the timer made was a timeout; taking it back takes the count back.
  const [slot] = await tx
    .select()
    .from(draftTeamSlots)
    .where(eq(draftTeamSlots.id, last.slotId))
  let timeouts = slot?.consecutiveTimeouts ?? 0
  if (slot && last.auto && last.reason?.startsWith("timer_")) {
    timeouts = Math.max(0, timeouts - 1)
    await tx
      .update(draftTeamSlots)
      .set({ consecutiveTimeouts: timeouts })
      .where(eq(draftTeamSlots.id, slot.id))
  }

  const reopen = draft.status === "complete"
  const running = reopen || draft.status === "in_progress"
  const seconds = draft.pickTimerSeconds
  const timing = await updateDraft(tx, draft, {
    currentPickNo: last.pickNo,
    ...(reopen ? { status: "in_progress", completedAt: null } : {}),
    turnDeadline: running && seconds ? deadlineIn(seconds) : null,
    pausedRemainingMs: !running && seconds ? seconds * 1000 : null,
  })
  if (!timing) throw new Error("The locked draft changed under the undo")

  await appendDraftEvent(tx, draft.id, "undo", input.actor.userId, {
    pickNo: last.pickNo,
    slotId: last.slotId,
    poolEntryId: last.poolEntryId,
    consecutiveTimeouts: timeouts,
    ...timerPayload(timing),
  })
  await auditManagerAction(tx, draft, input.actor, "draft.undo", {
    before: {
      status: draft.status,
      pickNo: last.pickNo,
      slotId: last.slotId,
      poolEntryId: last.poolEntryId,
    },
    after: { status: reopen ? "in_progress" : draft.status },
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
    .where(and(eq(draftPicks.draftId, draft.id), isNull(draftPicks.undoneAt)))
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
    await auditManagerAction(inner, draft, input.actor, "draft.apply", {
      before: { status: draft.status, applied: false },
      after: { applied: true, addedUserIds: applied, skippedUserIds: skipped },
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
