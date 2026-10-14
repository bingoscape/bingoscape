"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { draftSettingsSchema } from "@/lib/draft/setup"
import { getServerAuthSession } from "@/server/auth"
import type { ActionResult } from "@/server/authz"
import { eventIdOfDraft } from "@/server/authz"
import { eventAction } from "@/server/authz/action"
import { toActionResult } from "@/server/draft/action-result"
import {
  applyDraft as applyDraftCore,
  cancelDraft as cancelDraftCore,
  createDraft as createDraftCore,
  pauseDraft as pauseDraftCore,
  performPick,
  resumeDraft as resumeDraftCore,
  startDraft as startDraftCore,
  undoPick as undoPickCore,
} from "@/server/draft/core"
import { limitAction } from "@/server/rate-limit"

/**
 * Team draft server actions (epic #214, phase 1/4 #215). Each is an
 * `eventAction`: the input is parsed, the actor is authorized for the
 * permission below (the Event is resolved from the draft id in the database,
 * never trusted from the client), and the body runs in one transaction. The
 * logic lives in `src/server/draft/core.ts`; the exports here are thin and all
 * return `{ success, error? }`.
 *
 * `makePick` asks for `draft:view` here and for `draft:pick` in the body: who
 * may pick depends on whose turn it is, which is only known under the draft
 * row lock (the Team of the on-turn slot is passed to the policy there).
 */

const draftIdSchema = z.object({ draftId: z.string().uuid() })
const pickSchema = draftIdSchema.extend({ poolEntryId: z.string().uuid() })

type WithEvent<T extends object> = T & { eventId: string }

const withEvent = <T extends object>(
  result: ActionResult<T>,
  eventId: string
): ActionResult<WithEvent<T>> =>
  result.success ? { ...result, eventId } : result

const createDraftAction = eventAction({
  schema: draftSettingsSchema.extend({ eventId: z.string().uuid() }),
  permission: "draft:manage",
  eventIdOf: (input) => input.eventId,
}).action(async ({ parsedInput, ctx }) => {
  const { eventId, ...settings } = parsedInput
  return withEvent(
    await createDraftCore(ctx.tx, { eventId, actor: ctx.actor, settings }),
    ctx.actor.eventId
  )
})

const startDraftAction = eventAction({
  schema: draftIdSchema,
  permission: "draft:manage",
  eventIdOf: (input) => eventIdOfDraft(input.draftId),
}).action(async ({ parsedInput, ctx }) =>
  withEvent(
    await startDraftCore(ctx.tx, {
      draftId: parsedInput.draftId,
      actor: ctx.actor,
    }),
    ctx.actor.eventId
  )
)

const pauseDraftAction = eventAction({
  schema: draftIdSchema,
  permission: "draft:manage",
  eventIdOf: (input) => eventIdOfDraft(input.draftId),
}).action(async ({ parsedInput, ctx }) =>
  withEvent(
    await pauseDraftCore(ctx.tx, {
      draftId: parsedInput.draftId,
      actor: ctx.actor,
    }),
    ctx.actor.eventId
  )
)

const resumeDraftAction = eventAction({
  schema: draftIdSchema,
  permission: "draft:manage",
  eventIdOf: (input) => eventIdOfDraft(input.draftId),
}).action(async ({ parsedInput, ctx }) =>
  withEvent(
    await resumeDraftCore(ctx.tx, {
      draftId: parsedInput.draftId,
      actor: ctx.actor,
    }),
    ctx.actor.eventId
  )
)

const cancelDraftAction = eventAction({
  schema: draftIdSchema,
  permission: "draft:manage",
  eventIdOf: (input) => eventIdOfDraft(input.draftId),
}).action(async ({ parsedInput, ctx }) =>
  withEvent(
    await cancelDraftCore(ctx.tx, {
      draftId: parsedInput.draftId,
      actor: ctx.actor,
    }),
    ctx.actor.eventId
  )
)

const makePickAction = eventAction({
  schema: pickSchema,
  permission: "draft:view",
  eventIdOf: (input) => eventIdOfDraft(input.draftId),
}).action(async ({ parsedInput, ctx }) =>
  withEvent(
    // `draft:pick` is evaluated against the on-turn Team inside performPick.
    await performPick(ctx.tx, {
      draftId: parsedInput.draftId,
      poolEntryId: parsedInput.poolEntryId,
      actor: ctx.actor,
    }),
    ctx.actor.eventId
  )
)

const forcePickAction = eventAction({
  schema: pickSchema,
  permission: "draft:manage",
  eventIdOf: (input) => eventIdOfDraft(input.draftId),
}).action(async ({ parsedInput, ctx }) =>
  withEvent(
    await performPick(ctx.tx, {
      draftId: parsedInput.draftId,
      poolEntryId: parsedInput.poolEntryId,
      actor: ctx.actor,
      force: true,
    }),
    ctx.actor.eventId
  )
)

const undoPickAction = eventAction({
  schema: draftIdSchema,
  permission: "draft:manage",
  eventIdOf: (input) => eventIdOfDraft(input.draftId),
}).action(async ({ parsedInput, ctx }) =>
  withEvent(
    await undoPickCore(ctx.tx, {
      draftId: parsedInput.draftId,
      actor: ctx.actor,
    }),
    ctx.actor.eventId
  )
)

const applyDraftAction = eventAction({
  schema: draftIdSchema,
  permission: "draft:manage",
  eventIdOf: (input) => eventIdOfDraft(input.draftId),
}).action(async ({ parsedInput, ctx }) =>
  withEvent(
    await applyDraftCore(ctx.tx, {
      draftId: parsedInput.draftId,
      actor: ctx.actor,
    }),
    ctx.actor.eventId
  )
)

/**
 * Revalidates what a successful change shows: the draft room always; the Event
 * pages too when the draft's status or the Teams changed (header entry point,
 * rosters).
 */
function revalidateDraft(eventId: string, wide: boolean) {
  revalidatePath(`/events/${eventId}/draft`)
  if (wide) revalidatePath(`/events/${eventId}`, "layout")
}

async function finish<T extends object>(
  outcome: Parameters<typeof toActionResult<WithEvent<T>>>[0],
  wide: boolean
): Promise<ActionResult<WithEvent<T>>> {
  const result = toActionResult<WithEvent<T>>(outcome)
  if (result.success) revalidateDraft(result.eventId, wide)
  return result
}

export type CreateDraftInput = z.input<typeof draftSettingsSchema> & {
  eventId: string
}

/** Creates a draft in `setup` for the Event (`draft:manage`). */
export async function createDraft(
  input: CreateDraftInput
): Promise<ActionResult<{ draftId: string; eventId: string }>> {
  return finish(await createDraftAction(input), true)
}

/** Creates the Teams, freezes the pool and starts the draft (`draft:manage`). */
export async function startDraft(input: {
  draftId: string
}): Promise<
  ActionResult<{ poolSize: number; teams: number; eventId: string }>
> {
  return finish(await startDraftAction(input), true)
}

export async function pauseDraft(input: {
  draftId: string
}): Promise<ActionResult<{ eventId: string }>> {
  return finish(await pauseDraftAction(input), true)
}

export async function resumeDraft(input: {
  draftId: string
}): Promise<ActionResult<{ eventId: string }>> {
  return finish(await resumeDraftAction(input), true)
}

/** Cancels the draft and deletes the Teams it created if still empty (`draft:manage`). */
export async function cancelDraft(input: {
  draftId: string
}): Promise<
  ActionResult<{ deletedTeams: number; keptTeams: number; eventId: string }>
> {
  return finish(await cancelDraftAction(input), true)
}

/** A captain picks a player when it is their turn. */
export async function makePick(input: {
  draftId: string
  poolEntryId: string
}): Promise<
  ActionResult<{ pickNo: number; completed: boolean; eventId: string }>
> {
  const session = await getServerAuthSession()
  const limited = await limitAction("draftPick", session?.user?.id)
  if (limited) return limited
  return finish(await makePickAction(input), false)
}

/** A manager picks for the captain whose turn it is (`draft:manage`). */
export async function forcePick(input: {
  draftId: string
  poolEntryId: string
}): Promise<
  ActionResult<{ pickNo: number; completed: boolean; eventId: string }>
> {
  const session = await getServerAuthSession()
  const limited = await limitAction("draftPick", session?.user?.id)
  if (limited) return limited
  return finish(await forcePickAction(input), false)
}

/** Removes the last pick (`draft:manage`, managers only). */
export async function undoPick(input: {
  draftId: string
}): Promise<ActionResult<{ pickNo: number; eventId: string }>> {
  return finish(await undoPickAction(input), false)
}

/** The manager's confirmation: drafted players join their Teams (`draft:manage`). */
export async function applyDraft(input: {
  draftId: string
}): Promise<
  ActionResult<{ applied: number; skippedUserIds: string[]; eventId: string }>
> {
  return finish(await applyDraftAction(input), true)
}
