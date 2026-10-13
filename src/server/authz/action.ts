import "server-only"

import type { SafeActionClient, ValidationErrors } from "next-safe-action"
import type { z } from "zod"

import type { Permission } from "@/lib/authz/permissions"
import type { EventActor, PolicyResource } from "@/lib/authz/policy"
import { actionClient } from "@/lib/safe-action"
import { db } from "@/server/db"
import { authorize } from "./guards"
import { AuthzError } from "./errors"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Thrown to roll the transaction back when the action itself failed. */
class ActionFailed extends Error {
  constructor(readonly result: unknown) {
    super("Action failed")
  }
}

/** The client `eventAction` returns: `actionClient` plus the schema and `ctx`. */
type TypedEventActionClient<S extends z.ZodTypeAny> = SafeActionClient<
  string,
  undefined,
  undefined,
  undefined,
  true,
  { actor: EventActor; tx: Tx },
  undefined,
  S,
  undefined,
  readonly [],
  ValidationErrors<S>,
  false,
  true,
  object
>

interface EventActionOptions<S extends z.ZodTypeAny> {
  /** Zod (or any Standard Schema) schema for the raw client input. */
  schema: S
  /** The permission the caller needs. */
  permission: Permission
  /**
   * The Event the action is about. Derive it from the parsed input; for ids of
   * child rows (a Tile, a Goal, ...) resolve the Event with the helpers in
   * `resolve.ts` instead of trusting a client supplied eventId.
   */
  eventIdOf: (input: z.output<S>) => string | Promise<string>
  /** Relational context for the policy (Team, target role, ...). */
  resourceOf?: (input: z.output<S>) => PolicyResource | undefined
}

/**
 * A `next-safe-action` client for Event scoped mutations, modelled on
 * `adminAction`:
 *
 *   1. the raw input is parsed with `schema`
 *   2. the actor is loaded and the policy is checked for `permission`
 *      (a denial becomes the action's `serverError`)
 *   3. the action body runs inside one `db.transaction`; `ctx.tx` is the
 *      transaction and `ctx.actor` the authorised actor. A failing action
 *      rolls the transaction back.
 *
 *   export const renameEvent = eventAction({
 *     schema: z.object({ eventId: z.string().uuid(), title: z.string() }),
 *     permission: "event:update",
 *     eventIdOf: (input) => input.eventId,
 *   }).action(async ({ parsedInput, ctx: { tx } }) => { ... })
 */
export function eventAction<S extends z.ZodTypeAny>(
  options: EventActionOptions<S>
) {
  // `S` is generic, which next-safe-action's conditional `this` types cannot
  // resolve; the chain is built on `z.ZodTypeAny` and typed again on return.
  const client = actionClient
    .inputSchema(options.schema as z.ZodTypeAny)
    .useValidated(async ({ parsedInput, next }) => {
      const input = parsedInput as z.output<S>
      const result = await authorize(
        await options.eventIdOf(input),
        options.permission,
        options.resourceOf?.(input)
      )
      if (!result.success) throw new AuthzError(result.error, result.code)

      try {
        return await db.transaction(async (tx) => {
          const nextResult = await next({
            ctx: { actor: result.actor, tx: tx as Tx },
          })
          if (!nextResult.success) throw new ActionFailed(nextResult)
          return nextResult
        })
      } catch (error) {
        if (error instanceof ActionFailed) {
          return error.result as Awaited<ReturnType<typeof next>>
        }
        throw error
      }
    })
  return client as unknown as TypedEventActionClient<S>
}
