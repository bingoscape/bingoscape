/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { logger } from "@/lib/logger";
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { NextResponse } from "next/server"
import { db } from "@/server/db"
import {
  goals,
  itemGoals,
  teamGoalProgress,
  teamMembers,
  eventParticipants,
  tiles,
  bingos,
} from "@/server/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { validateApiKey } from "@/lib/api-auth"
import { z } from "zod"
import { doesItemMatchBaseName } from "@/app/actions/osrs-items"
import { checkAndAutoCompleteTile } from "@/app/actions/tile-completion"

// Zod schema for item data from RuneLite
const ItemDataSchema = z.object({
  itemId: z.number(),
  itemName: z.string(),
  quantity: z.number(),
})

const RequestSchema = z.object({
  items: z.array(ItemDataSchema),
  eventIds: z.array(z.string()).optional(), // Optional: filter by specific events
})

interface MatchedGoal {
  goalId: string
  tileId: string
  bingoId: string
  eventId: string
  teamId: string
  itemName: string
  baseName: string
  previousValue: number
  newValue: number
  targetValue: number
  isComplete: boolean
}

/**
 * RuneLite API endpoint for automatic item goal detection and progress updates
 * POST /api/runelite/items/check
 *
 * This endpoint accepts a list of items from the RuneLite plugin and:
 * 1. Finds all active item goals for the user's events
 * 2. Matches items against goal base names (variant-agnostic)
 * 3. Updates goal progress automatically
 * 4. Triggers tile auto-completion when goals are met
 *
 * Authorization: Bearer token (API key)
 *
 * Request body:
 * {
 *   "items": [
 *     { "itemId": 1234, "itemName": "Dragon scimitar", "quantity": 1 },
 *     { "itemId": 5678, "itemName": "Amulet of glory (4)", "quantity": 5 }
 *   ],
 *   "eventIds": ["uuid1", "uuid2"] // Optional: filter by specific events
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "matched": [
 *     {
 *       "goalId": "...",
 *       "itemName": "Amulet of glory (4)",
 *       "baseName": "Amulet of glory",
 *       "previousValue": 0,
 *       "newValue": 1,
 *       "targetValue": 1,
 *       "isComplete": true
 *     }
 *   ],
 *   "tilesAutoCompleted": ["tileId1", "tileId2"],
 *   "scannedItems": 2,
 *   "matchedGoals": 1
 * }
 */
export async function POST(req: Request) {
  // Validate API key
  const userId = await validateApiKey(req)
  if (!userId) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  try {
    // Parse and validate request body
    const body = (await req.json()) as unknown
    const { items, eventIds } = RequestSchema.parse(body)

    if (items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 })
    }

    // Get all events the user is participating in
    let userEvents = await db.query.eventParticipants.findMany({
      where: eq(eventParticipants.userId, userId),
      with: {
        event: {
          columns: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    })

    // Filter by specific event IDs if provided
    if (eventIds && eventIds.length > 0) {
      userEvents = userEvents.filter((ep) => eventIds.includes(ep.eventId))
    }

    if (userEvents.length === 0) {
      return NextResponse.json({
        success: true,
        matched: [],
        tilesAutoCompleted: [],
        scannedItems: items.length,
        matchedGoals: 0,
        message: "User is not participating in any events",
      })
    }

    const userEventIds = userEvents.map((ep) => ep.eventId)

    // Get all teams for the user across these events
    const userTeams = await db.query.teams.findMany({
      where: (teams, { and, eq, exists }) =>
        and(
          inArray(teams.eventId, userEventIds),
          exists(
            db
              .select()
              .from(teamMembers)
              .where(and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, userId))),
          ),
        ),
      columns: {
        id: true,
        eventId: true,
        name: true,
      },
    })

    if (userTeams.length === 0) {
      return NextResponse.json({
        success: true,
        matched: [],
        tilesAutoCompleted: [],
        scannedItems: items.length,
        matchedGoals: 0,
        message: "User is not assigned to any teams",
      })
    }

    // Get all item goals for these events
    const allItemGoals = await db
      .select({
        goalId: itemGoals.goalId,
        itemId: itemGoals.itemId,
        baseName: itemGoals.baseName,
        exactVariant: itemGoals.exactVariant,
        imageUrl: itemGoals.imageUrl,
        tileId: goals.tileId,
        targetValue: goals.targetValue,
        description: goals.description,
        eventId: bingos.eventId,
      })
      .from(itemGoals)
      .innerJoin(goals, eq(itemGoals.goalId, goals.id))
      .innerJoin(tiles, eq(goals.tileId, tiles.id))
      .innerJoin(bingos, eq(tiles.bingoId, bingos.id))
      .where(inArray(bingos.eventId, userEventIds))

    if (allItemGoals.length === 0) {
      return NextResponse.json({
        success: true,
        matched: [],
        tilesAutoCompleted: [],
        scannedItems: items.length,
        matchedGoals: 0,
        message: "No item goals found for user's events",
      })
    }

    // Match items against goals
    const matchedGoals: MatchedGoal[] = []
    const tilesNeedingCheck = new Set<{ tileId: string; teamId: string }>()

    for (const item of items) {
      for (const itemGoal of allItemGoals) {
        // Check if item matches the goal's base name
        const matchResult = await doesItemMatchBaseName(item.itemName, itemGoal.baseName)

        if (!matchResult.success || !matchResult.matches) {
          continue
        }

        // Item matches! Update progress for all teams in the same event
        for (const team of userTeams) {
          // Skip if team is not in the same event as the goal
          if (team.eventId !== itemGoal.eventId) {
            continue
          }

          // Get current progress
          const existingProgress = await db.query.teamGoalProgress.findFirst({
            where: and(
              eq(teamGoalProgress.goalId, itemGoal.goalId),
              eq(teamGoalProgress.teamId, team.id),
            ),
          })

          const previousValue = existingProgress?.currentValue ?? 0
          const newValue = Math.min(item.quantity, itemGoal.targetValue)

          // Only update if quantity increased
          if (newValue > previousValue) {
            // Upsert progress
            await db
              .insert(teamGoalProgress)
              .values({
                goalId: itemGoal.goalId,
                teamId: team.id,
                currentValue: newValue,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [teamGoalProgress.goalId, teamGoalProgress.teamId],
                set: {
                  currentValue: newValue,
                  updatedAt: new Date(),
                },
              })

            matchedGoals.push({
              goalId: itemGoal.goalId,
              tileId: itemGoal.tileId,
              bingoId: "", // Will be populated if needed
              eventId: team.eventId,
              teamId: team.id,
              itemName: item.itemName,
              baseName: itemGoal.baseName,
              previousValue,
              newValue,
              targetValue: itemGoal.targetValue,
              isComplete: newValue >= itemGoal.targetValue,
            })

            // Mark tile for completion check
            tilesNeedingCheck.add({ tileId: itemGoal.tileId, teamId: team.id })
          }
        }
      }
    }

    // Check and auto-complete tiles
    const tilesAutoCompleted: string[] = []
    for (const { tileId, teamId } of tilesNeedingCheck) {
      const result = await checkAndAutoCompleteTile(tileId, teamId)
      if (result.success && result.autoCompleted) {
        tilesAutoCompleted.push(tileId)
      }
    }

    return NextResponse.json({
      success: true,
      matched: matchedGoals.map((m) => ({
        goalId: m.goalId,
        itemName: m.itemName,
        baseName: m.baseName,
        previousValue: m.previousValue,
        newValue: m.newValue,
        targetValue: m.targetValue,
        isComplete: m.isComplete,
        tileId: m.tileId,
        eventId: m.eventId,
      })),
      tilesAutoCompleted,
      scannedItems: items.length,
      matchedGoals: matchedGoals.length,
    })
  } catch (error) {
    logger.error({ error }, "Error checking items:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: error.errors,
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to check items",
      },
      { status: 500 },
    )
  }
}
