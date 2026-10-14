import { and, asc, desc, eq, exists, inArray } from "drizzle-orm"

import { MANAGER_ROLES } from "@/lib/authz/roles"
import { db } from "@/server/db"
import {
  bingos,
  eventParticipants,
  events,
  type BingoType,
} from "@/server/db/schema"
import { logger } from "@/lib/logger"

/**
 * Events the user can manage: a participant with the `admin` or `management`
 * role (the creator holds an admin row). This mirrors the `board:manage` permission
 * (src/lib/authz/permissions.ts), which is what the import and export actions enforce,
 * so the pickers never offer an Event the action would then reject.
 *
 * Not a "use server" module: it takes the user id as an argument.
 */

export interface ManageableBoard {
  id: string
  title: string
  rows: number
  columns: number
  bingoType: BingoType
}

export interface ManageableEvent {
  id: string
  title: string
  boards: ManageableBoard[]
}

const MAX_EVENTS = 200

export async function getManageableEvents(
  userId: string,
  options: { withBoards?: boolean } = {}
): Promise<ManageableEvent[]> {
  try {
    const rows = await db
      .select({ id: events.id, title: events.title })
      .from(events)
      .where(
        exists(
          db
            .select({ id: eventParticipants.id })
            .from(eventParticipants)
            .where(
              and(
                eq(eventParticipants.eventId, events.id),
                eq(eventParticipants.userId, userId),
                inArray(eventParticipants.role, [...MANAGER_ROLES])
              )
            )
        )
      )
      .orderBy(desc(events.createdAt))
      .limit(MAX_EVENTS)

    if (!options.withBoards || rows.length === 0) {
      return rows.map((event) => ({ ...event, boards: [] }))
    }

    const boardRows = await db
      .select({
        id: bingos.id,
        eventId: bingos.eventId,
        title: bingos.title,
        rows: bingos.rows,
        columns: bingos.columns,
        bingoType: bingos.bingoType,
      })
      .from(bingos)
      .where(
        inArray(
          bingos.eventId,
          rows.map((event) => event.id)
        )
      )
      .orderBy(asc(bingos.createdAt))

    return rows.map((event) => ({
      ...event,
      boards: boardRows
        .filter((board) => board.eventId === event.id)
        .map(({ eventId: _eventId, ...board }) => board),
    }))
  } catch (error) {
    logger.error({ error }, "Error fetching manageable events:", error)
    return []
  }
}
