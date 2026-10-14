import "server-only"

import { cache } from "react"

import {
  computeCapabilities,
  type EventCapabilities,
} from "@/lib/authz/capabilities"
import { logger } from "@/lib/logger"
import { getEventActor } from "./actor"

/**
 * What the signed-in user may do in an Event, for the UI. Wrapped in React
 * `cache()` on top of the cached actor, so the Event layout, the gates and the
 * pages of one request share one lookup and one computation. A signed-out
 * caller, a non-member, an unknown Event or a failed lookup all get no
 * capabilities (fail closed).
 *
 * Capabilities only decide what is shown; every action is still checked by the
 * server guard. Not a "use server" module: not callable from the client.
 */
export const getEventCapabilities = cache(
  async (eventId: string): Promise<EventCapabilities> => {
    try {
      const lookup = await getEventActor(eventId)
      return computeCapabilities(lookup.status === "ok" ? lookup.actor : null)
    } catch (error) {
      logger.error({ error }, "Error computing event capabilities")
      return computeCapabilities(null)
    }
  }
)
