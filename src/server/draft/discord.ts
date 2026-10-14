import "server-only"

import { and, asc, eq, gt, isNull } from "drizzle-orm"

import {
  createDraftAppliedEmbed,
  createDraftCompleteEmbed,
  createDraftPickEmbed,
  createDraftStartedEmbed,
  createDraftUndoEmbed,
  getTeamHslColor,
  sendDiscordWebhook,
  type DiscordEmbed,
  type DraftRosterEmbedTeam,
} from "@/lib/discord-webhook"
import { totalPicks } from "@/lib/draft/order"
import type { DraftEventPayloads, DraftOrderType } from "@/lib/draft/types"
import { playerLabel, ratingPoints } from "@/lib/draft/view"
import { logger } from "@/lib/logger"
import { db } from "@/server/db"
import {
  discordWebhooks,
  draftEvents,
  draftPicks,
  draftPoolEntries,
  draftTeamSlots,
  drafts,
  events,
  type DraftEventRow,
  type DraftPoolEntryRow,
  type DraftRow,
  type DraftTeamSlotRow,
} from "@/server/db/schema"
import { lockDraft } from "./internal"
import { loadPlayers } from "./queries"

/**
 * Discord posts for the team draft (team draft 4/4, #218): draft start, each
 * pick, undo, completion and the applied teams, sent to the Event's active
 * webhooks.
 *
 * Posting is strictly after the fact. The lifecycle (`core.ts`) and the timer
 * (`expire.ts`) only write rows and log events; the code that ran them calls
 * `flushDraftDiscord(draftId)` once its transaction has committed (server
 * actions, the sweeper, the lazy expiry of a state read). A slow, failing or
 * missing webhook can therefore neither block nor roll back a pick, and every
 * error here is logged and swallowed: `flushDraftDiscord` never throws.
 *
 * Which events were posted is tracked by `draft.discord_posted_seq`. The flush
 * claims the unposted events under the draft row lock and advances the cursor
 * in the same short transaction, so two flushes (a pick and the sweeper, two
 * instances) never post the same event twice. A crash between the claim and
 * the HTTP calls loses that post; Discord is a notification, not a record.
 */

/** The log events that are posted; the others (created, timer, skipped...) are not. */
const POSTED_EVENT_TYPES: ReadonlySet<string> = new Set([
  "started",
  "pick",
  "undo",
  "completed",
  "applied",
])

const ORDER_LABELS: Record<DraftOrderType, string> = {
  linear: "Linear",
  snake: "Snake",
  random_snake: "Random snake",
}

interface Claim {
  draft: DraftRow
  events: DraftEventRow[]
}

/** Takes the draft's unposted events and moves the cursor past them. */
async function claimUnposted(draftId: string): Promise<Claim | null> {
  return db.transaction(async (tx) => {
    const draft = await lockDraft(tx, draftId)
    if (!draft) return null
    const rows = await tx
      .select()
      .from(draftEvents)
      .where(
        and(
          eq(draftEvents.draftId, draftId),
          gt(draftEvents.seq, draft.discordPostedSeq)
        )
      )
      .orderBy(asc(draftEvents.seq))
    const last = rows[rows.length - 1]
    if (!last) return null
    // Not `updateDraft`: this is bookkeeping, it must not bump `version`
    // (clients compare it) or care about the status.
    await tx
      .update(drafts)
      .set({ discordPostedSeq: last.seq })
      .where(eq(drafts.id, draftId))
    return {
      draft,
      events: rows.filter((row) => POSTED_EVENT_TYPES.has(row.type)),
    }
  })
}

interface Context {
  eventTitle: string
  slots: DraftTeamSlotRow[]
  pool: Map<string, DraftPoolEntryRow>
  names: Map<string, string>
}

async function loadContext(draft: DraftRow): Promise<Context> {
  const [[event], slots, poolRows] = await Promise.all([
    db
      .select({ title: events.title })
      .from(events)
      .where(eq(events.id, draft.eventId))
      .limit(1),
    db
      .select()
      .from(draftTeamSlots)
      .where(eq(draftTeamSlots.draftId, draft.id))
      .orderBy(asc(draftTeamSlots.position)),
    db
      .select()
      .from(draftPoolEntries)
      .where(eq(draftPoolEntries.draftId, draft.id)),
  ])
  const userIds = [
    ...slots.map((s) => s.captainUserId),
    ...poolRows.map((e) => e.userId),
  ].filter((id): id is string => id !== null)
  const players = await loadPlayers(draft.eventId, [...new Set(userIds)])
  return {
    eventTitle: event?.title ?? "Team draft",
    slots,
    pool: new Map(poolRows.map((e) => [e.id, e])),
    names: new Map(players.map((p) => [p.userId, playerLabel(p)])),
  }
}

const nameOf = (context: Context, userId: string | null) =>
  userId ? (context.names.get(userId) ?? "Unknown player") : "Unknown player"

/** The standing picks per team, in pick order, for the roster embeds. */
async function loadRosters(
  draft: DraftRow,
  context: Context
): Promise<DraftRosterEmbedTeam[]> {
  const picks = await db
    .select()
    .from(draftPicks)
    .where(and(eq(draftPicks.draftId, draft.id), isNull(draftPicks.undoneAt)))
    .orderBy(asc(draftPicks.pickNo))
  return context.slots.map((slot) => ({
    teamName: slot.teamName,
    captainName: nameOf(context, slot.captainUserId),
    players: picks
      .filter((pick) => pick.slotId === slot.id)
      .map((pick) =>
        nameOf(context, context.pool.get(pick.poolEntryId)?.userId ?? null)
      ),
  }))
}

async function embedFor(
  draft: DraftRow,
  context: Context,
  row: DraftEventRow
): Promise<DiscordEmbed | null> {
  const slotOf = (slotId: string) =>
    context.slots.find((slot) => slot.id === slotId)
  switch (row.type) {
    case "started": {
      const payload = row.payload as unknown as DraftEventPayloads["started"]
      const ordered = payload.permutation.flatMap((position) => {
        const slot = context.slots.find((s) => s.position === position)
        return slot
          ? [
              {
                teamName: slot.teamName,
                captainName: nameOf(context, slot.captainUserId),
              },
            ]
          : []
      })
      return createDraftStartedEmbed({
        eventTitle: context.eventTitle,
        teams: ordered,
        poolSize: payload.pool.length,
        rounds: draft.rounds,
        orderLabel: ORDER_LABELS[draft.orderType],
        pickTimerSeconds: draft.pickTimerSeconds,
      })
    }
    case "pick": {
      const payload = row.payload as unknown as DraftEventPayloads["pick"]
      const slot = slotOf(payload.slotId)
      if (!slot) return null
      const entry = context.pool.get(payload.poolEntryId)
      return createDraftPickEmbed({
        eventTitle: context.eventTitle,
        pickNo: payload.pickNo,
        totalPicks: totalPicks(draft.rounds, context.slots.length),
        round: payload.round,
        teamName: slot.teamName,
        teamColor: getTeamHslColor(slot.teamName),
        playerName: nameOf(context, payload.userId ?? entry?.userId ?? null),
        rating: ratingPoints(entry?.ratingSnapshot ?? null),
        madeBy: payload.forced ? "forced" : payload.auto ? "timer" : null,
      })
    }
    case "undo": {
      const payload = row.payload as unknown as DraftEventPayloads["undo"]
      const slot = slotOf(payload.slotId)
      if (!slot) return null
      return createDraftUndoEmbed({
        eventTitle: context.eventTitle,
        pickNo: payload.pickNo,
        teamName: slot.teamName,
        playerName: nameOf(
          context,
          context.pool.get(payload.poolEntryId)?.userId ?? null
        ),
      })
    }
    case "completed":
      return createDraftCompleteEmbed({
        eventTitle: context.eventTitle,
        teams: await loadRosters(draft, context),
      })
    case "applied":
      return createDraftAppliedEmbed({
        eventTitle: context.eventTitle,
        teams: await loadRosters(draft, context),
      })
    default:
      return null
  }
}

/**
 * Posts what happened in the draft since the last flush. Call it after the
 * transaction that wrote the events has committed; do not await it on the
 * request path (the server actions let it run on). Never throws.
 */
export async function flushDraftDiscord(draftId: string): Promise<void> {
  try {
    const claim = await claimUnposted(draftId)
    if (!claim || claim.events.length === 0) return

    const webhooks = await db
      .select({ webhookUrl: discordWebhooks.webhookUrl })
      .from(discordWebhooks)
      .where(
        and(
          eq(discordWebhooks.eventId, claim.draft.eventId),
          eq(discordWebhooks.isActive, true)
        )
      )
    if (webhooks.length === 0) return

    const context = await loadContext(claim.draft)
    // One message per event, in order: Discord shows them in arrival order.
    for (const row of claim.events) {
      const embed = await embedFor(claim.draft, context, row)
      if (!embed) continue
      await Promise.allSettled(
        // `async`: a send that throws before it returns a promise is still
        // one failed post, not the end of the flush.
        webhooks.map(async (webhook) =>
          sendDiscordWebhook(webhook.webhookUrl, { embeds: [embed] })
        )
      )
    }
  } catch (error) {
    logger.error({ error, draftId }, "Could not post the draft to Discord")
  }
}
