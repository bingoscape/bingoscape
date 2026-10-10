import type { Page } from "@playwright/test"
import { db } from "../../src/server/db"
import {
  bingos,
  eventParticipants,
  events,
  goals,
  teamMembers,
  teams,
  tiles,
  tierXpRequirements,
  users,
} from "../../src/server/db/schema"
import { hashPassword } from "../../src/lib/password"

export interface SeedBoard {
  title: string
  rows: number
  columns: number
  bingoType?: "standard" | "progression"
  /** Tile indices that are hidden placeholders. */
  hidden?: number[]
}

export interface SeededEvent {
  eventId: string
  userId: string
  username: string
  teamIds: string[]
  boards: Array<{ id: string; title: string; rows: number; columns: number }>
  /** First visible tile id of each Board, by Board id. */
  firstTileByBoard: Record<string, string>
}

/** Creates a user that can sign in with the credentials form. */
export async function createUser(username: string): Promise<string> {
  const userId = crypto.randomUUID()
  await db.insert(users).values({
    id: userId,
    name: `User ${username}`,
    email: `${username}@example.com`,
    username,
    runescapeName: username,
    password: await hashPassword("password123"),
  })
  return userId
}

/** Signs in through the real form. */
export async function signIn(page: Page, username: string): Promise<void> {
  await page.goto("/sign-in")
  await page.fill('input[id="username"]', username)
  await page.fill('input[id="password"]', "password123")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/")
}

/**
 * Seeds an Event with Boards, Tiles (one Goal on the first Tile of every
 * Board) and two Teams. `role` is the signed-in user's role in the Event; as
 * a participant they are placed in the first Team.
 */
export async function seedEvent(options: {
  userId: string
  username: string
  role: "admin" | "participant"
  boards: SeedBoard[]
  isPublic?: boolean
}): Promise<SeededEvent> {
  const { userId, username, role, boards, isPublic = false } = options
  const eventId = crypto.randomUUID()
  const now = Date.now()

  await db.insert(events).values({
    id: eventId,
    title: `E2E Event ${eventId.slice(0, 6)}`,
    description: "End-to-end test event",
    startDate: new Date(now - 24 * 3600 * 1000),
    endDate: new Date(now + 7 * 24 * 3600 * 1000),
    timezone: "UTC",
    creatorId: role === "admin" ? userId : null,
    public: isPublic,
    basePrizePool: 50_000_000,
    minimumBuyIn: 1_000_000,
  })

  await db.insert(eventParticipants).values({ eventId, userId, role })

  const teamIds = [crypto.randomUUID(), crypto.randomUUID()]
  await db.insert(teams).values([
    { id: teamIds[0]!, eventId, name: "Team Alpha" },
    { id: teamIds[1]!, eventId, name: "Team Bravo" },
  ])
  if (role === "participant") {
    await db.insert(teamMembers).values({ teamId: teamIds[0]!, userId })
  }

  const seededBoards: SeededEvent["boards"] = []
  const firstTileByBoard: Record<string, string> = {}

  for (const [boardIndex, board] of boards.entries()) {
    const bingoId = crypto.randomUUID()
    await db.insert(bingos).values({
      id: bingoId,
      eventId,
      title: board.title,
      description: `${board.title} description`,
      rows: board.rows,
      columns: board.columns,
      codephrase: "secret-phrase",
      bingoType: board.bingoType ?? "standard",
      visible: true,
      locked: false,
      createdAt: new Date(now + boardIndex * 1000),
    })

    const hidden = new Set(board.hidden ?? [])
    const tileRows = Array.from({ length: board.rows * board.columns }).map(
      (_, index) => ({
        id: crypto.randomUUID(),
        bingoId,
        title: hidden.has(index) ? `Secret ${index}` : `Tile ${index + 1}`,
        description: hidden.has(index)
          ? "do not leak"
          : `Description of tile ${index + 1}`,
        weight: 1 + (index % 5),
        index,
        isHidden: hidden.has(index),
        // progression boards: one tier per row
        tier:
          board.bingoType === "progression"
            ? Math.floor(index / board.columns)
            : 0,
      })
    )
    await db.insert(tiles).values(tileRows)

    if (board.bingoType === "progression") {
      const tiers = new Set(tileRows.map((t) => t.tier))
      await db
        .insert(tierXpRequirements)
        .values([...tiers].map((tier) => ({ bingoId, tier, xpRequired: 5 })))
    }

    const firstVisible = tileRows.find((t) => !t.isHidden)!
    await db.insert(goals).values({
      tileId: firstVisible.id,
      description: "Obtain the item",
      targetValue: 1,
    })

    firstTileByBoard[bingoId] = firstVisible.id
    seededBoards.push({
      id: bingoId,
      title: board.title,
      rows: board.rows,
      columns: board.columns,
    })
  }

  return {
    eventId,
    userId,
    username,
    teamIds,
    boards: seededBoards,
    firstTileByBoard,
  }
}
