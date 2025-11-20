"use server"

import { db } from "@/server/db"
import {
  teams,
  teamTileSubmissions,
  tiles,
  users,
  submissions,
  goals,
  itemGoals,
  bingos,
  events,
} from "@/server/db/schema"
import { eq, and, isNotNull, inArray } from "drizzle-orm"
import { getItemAveragePrices } from "@/lib/osrs-ge-prices"

// Type definitions for item statistics
export interface ItemValueSubmission {
  submissionId: string
  userId: string
  userName: string
  runescapeName: string | null
  teamId: string
  teamName: string
  itemId: number
  itemName: string
  itemImageUrl: string
  quantity: number
  pricePerItem: number
  totalValue: number
  submittedAt: Date
  tileId: string
  tileTitle: string
}

export interface UserItemStats {
  userId: string
  userName: string
  runescapeName: string | null
  totalValue: number
  itemCount: number
  submissionCount: number
  mostValuableItem: {
    itemName: string
    itemImageUrl: string
    totalValue: number
  } | null
}

export interface TeamItemStats {
  teamId: string
  teamName: string
  totalValue: number
  itemCount: number
  submissionCount: number
  userCount: number
  averageValuePerUser: number
  mostValuableItem: {
    itemName: string
    itemImageUrl: string
    totalValue: number
  } | null
}

export interface MVPStats {
  userId: string
  userName: string
  runescapeName: string | null
  teamId: string
  teamName: string
  totalValue: number
  itemCount: number
  submissionCount: number
  valuePerSubmission: number
}

export interface MostValuableItemStats {
  itemId: number
  itemName: string
  itemImageUrl: string
  pricePerItem: number
  totalQuantity: number
  totalValue: number
  obtainedByCount: number
  obtainedBy: Array<{
    userId: string
    userName: string
    runescapeName: string | null
    teamName: string
    quantity: number
    value: number
  }>
}

export interface ItemStatistics {
  totalValue: number
  uniqueItemsCount: number
  totalSubmissions: number
  mvp: MVPStats | null
  topUsers: UserItemStats[]
  teamStats: TeamItemStats[]
  mostValuableItem: MostValuableItemStats | null
  profitPerHour: number | null
  allSubmissions: ItemValueSubmission[]
}

/**
 * Get comprehensive item statistics for a bingo board
 */
export async function getBingoItemStatistics(bingoId: string): Promise<ItemStatistics> {
  // Get all approved submissions with item goals for this bingo
  const itemSubmissions = await db
    .select({
      submissionId: submissions.id,
      submittedBy: submissions.submittedBy,
      submissionValue: submissions.submissionValue,
      createdAt: submissions.createdAt,
      userName: users.name,
      runescapeName: users.runescapeName,
      teamId: teams.id,
      teamName: teams.name,
      tileId: tiles.id,
      tileTitle: tiles.title,
      goalId: goals.id,
      targetValue: goals.targetValue,
      itemId: itemGoals.itemId,
      itemBaseName: itemGoals.baseName,
      itemImageUrl: itemGoals.imageUrl,
      submissionStatus: submissions.status,
    })
    .from(submissions)
    .innerJoin(teamTileSubmissions, eq(submissions.teamTileSubmissionId, teamTileSubmissions.id))
    .innerJoin(tiles, eq(teamTileSubmissions.tileId, tiles.id))
    .innerJoin(teams, eq(teamTileSubmissions.teamId, teams.id))
    .innerJoin(users, eq(submissions.submittedBy, users.id))
    .innerJoin(goals, eq(submissions.goalId, goals.id))
    .innerJoin(itemGoals, eq(itemGoals.goalId, goals.id))
    .where(
      and(
        eq(tiles.bingoId, bingoId),
        eq(submissions.status, "approved"),
        isNotNull(submissions.goalId),
      ),
    )

  if (itemSubmissions.length === 0) {
    return {
      totalValue: 0,
      uniqueItemsCount: 0,
      totalSubmissions: 0,
      mvp: null,
      topUsers: [],
      teamStats: [],
      mostValuableItem: null,
      profitPerHour: null,
      allSubmissions: [],
    }
  }

  // Extract unique item IDs and fetch prices
  const uniqueItemIds = [...new Set(itemSubmissions.map((s) => s.itemId))]
  const itemPrices = await getItemAveragePrices(uniqueItemIds)

  // Calculate item values for each submission
  const valuedSubmissions: ItemValueSubmission[] = itemSubmissions.map((submission) => {
    const quantity = submission.submissionValue ?? submission.targetValue
    const pricePerItem = itemPrices.get(submission.itemId) ?? 0
    const totalValue = Math.floor(quantity * pricePerItem)

    return {
      submissionId: submission.submissionId,
      userId: submission.submittedBy,
      userName: submission.userName ?? "Unknown",
      runescapeName: submission.runescapeName,
      teamId: submission.teamId,
      teamName: submission.teamName,
      itemId: submission.itemId,
      itemName: submission.itemBaseName,
      itemImageUrl: submission.itemImageUrl,
      quantity,
      pricePerItem,
      totalValue,
      submittedAt: submission.createdAt ?? new Date(),
      tileId: submission.tileId,
      tileTitle: submission.tileTitle,
    }
  })

  // Calculate user statistics
  const userStatsMap = new Map<string, UserItemStats>()
  for (const submission of valuedSubmissions) {
    const existing = userStatsMap.get(submission.userId) ?? {
      userId: submission.userId,
      userName: submission.userName,
      runescapeName: submission.runescapeName,
      totalValue: 0,
      itemCount: 0,
      submissionCount: 0,
      mostValuableItem: null,
    }

    existing.totalValue += submission.totalValue
    existing.itemCount += submission.quantity
    existing.submissionCount += 1

    // Track most valuable single submission for this user
    if (!existing.mostValuableItem || submission.totalValue > existing.mostValuableItem.totalValue) {
      existing.mostValuableItem = {
        itemName: submission.itemName,
        itemImageUrl: submission.itemImageUrl,
        totalValue: submission.totalValue,
      }
    }

    userStatsMap.set(submission.userId, existing)
  }

  // Calculate team statistics
  const teamStatsMap = new Map<string, TeamItemStats>()
  const teamUserCounts = new Map<string, Set<string>>()

  for (const submission of valuedSubmissions) {
    const existing = teamStatsMap.get(submission.teamId) ?? {
      teamId: submission.teamId,
      teamName: submission.teamName,
      totalValue: 0,
      itemCount: 0,
      submissionCount: 0,
      userCount: 0,
      averageValuePerUser: 0,
      mostValuableItem: null,
    }

    existing.totalValue += submission.totalValue
    existing.itemCount += submission.quantity
    existing.submissionCount += 1

    // Track most valuable single submission for this team
    if (!existing.mostValuableItem || submission.totalValue > existing.mostValuableItem.totalValue) {
      existing.mostValuableItem = {
        itemName: submission.itemName,
        itemImageUrl: submission.itemImageUrl,
        totalValue: submission.totalValue,
      }
    }

    teamStatsMap.set(submission.teamId, existing)

    // Track unique users per team
    const teamUsers = teamUserCounts.get(submission.teamId) ?? new Set<string>()
    teamUsers.add(submission.userId)
    teamUserCounts.set(submission.teamId, teamUsers)
  }

  // Calculate averages and finalize team stats
  const teamStats: TeamItemStats[] = []
  for (const [teamId, stats] of teamStatsMap.entries()) {
    const userCount = teamUserCounts.get(teamId)?.size ?? 0
    teamStats.push({
      ...stats,
      userCount,
      averageValuePerUser: userCount > 0 ? Math.floor(stats.totalValue / userCount) : 0,
    })
  }

  // Sort team stats by total value (descending)
  teamStats.sort((a, b) => b.totalValue - a.totalValue)

  // Get top users sorted by total value
  const topUsers = Array.from(userStatsMap.values()).sort((a, b) => b.totalValue - a.totalValue)

  // Calculate MVP (user with highest total value)
  let mvp: MVPStats | null = null
  if (topUsers.length > 0) {
    const topUser = topUsers[0]!
    const userSubmission = valuedSubmissions.find((s) => s.userId === topUser.userId)!

    mvp = {
      userId: topUser.userId,
      userName: topUser.userName,
      runescapeName: topUser.runescapeName,
      teamId: userSubmission.teamId,
      teamName: userSubmission.teamName,
      totalValue: topUser.totalValue,
      itemCount: topUser.itemCount,
      submissionCount: topUser.submissionCount,
      valuePerSubmission: Math.floor(topUser.totalValue / topUser.submissionCount),
    }
  }

  // Calculate most valuable item across all submissions
  const itemValueMap = new Map<
    number,
    {
      itemId: number
      itemName: string
      itemImageUrl: string
      pricePerItem: number
      totalQuantity: number
      totalValue: number
      obtainedBy: Map<
        string,
        {
          userId: string
          userName: string
          runescapeName: string | null
          teamName: string
          quantity: number
          value: number
        }
      >
    }
  >()

  for (const submission of valuedSubmissions) {
    const existing: {
      itemId: number
      itemName: string
      itemImageUrl: string
      pricePerItem: number
      totalQuantity: number
      totalValue: number
      obtainedBy: Map<
        string,
        {
          userId: string
          userName: string
          runescapeName: string | null
          teamName: string
          quantity: number
          value: number
        }
      >
    } = itemValueMap.get(submission.itemId) ?? {
      itemId: submission.itemId,
      itemName: submission.itemName,
      itemImageUrl: submission.itemImageUrl,
      pricePerItem: submission.pricePerItem,
      totalQuantity: 0,
      totalValue: 0,
      obtainedBy: new Map(),
    }

    existing.totalQuantity += submission.quantity
    existing.totalValue += submission.totalValue

    const userEntry: {
      userId: string
      userName: string
      runescapeName: string | null
      teamName: string
      quantity: number
      value: number
    } = existing.obtainedBy.get(submission.userId) ?? {
      userId: submission.userId,
      userName: submission.userName,
      runescapeName: submission.runescapeName,
      teamName: submission.teamName,
      quantity: 0,
      value: 0,
    }

    userEntry.quantity += submission.quantity
    userEntry.value += submission.totalValue
    existing.obtainedBy.set(submission.userId, userEntry)

    itemValueMap.set(submission.itemId, existing)
  }

  // Find the single most valuable item
  let mostValuableItem: MostValuableItemStats | null = null
  let highestValue = 0

  for (const itemData of itemValueMap.values()) {
    if (itemData.totalValue > highestValue) {
      highestValue = itemData.totalValue
      mostValuableItem = {
        itemId: itemData.itemId,
        itemName: itemData.itemName,
        itemImageUrl: itemData.itemImageUrl,
        pricePerItem: itemData.pricePerItem,
        totalQuantity: itemData.totalQuantity,
        totalValue: itemData.totalValue,
        obtainedByCount: itemData.obtainedBy.size,
        obtainedBy: Array.from(itemData.obtainedBy.values()).sort((a, b) => b.value - a.value),
      }
    }
  }

  // Calculate profit per hour
  const profitPerHour = await calculateBingoProfitPerHour(bingoId, valuedSubmissions)

  // Calculate total statistics
  const totalValue = valuedSubmissions.reduce((sum, s) => sum + s.totalValue, 0)
  const uniqueItemsCount = uniqueItemIds.length

  return {
    totalValue,
    uniqueItemsCount,
    totalSubmissions: valuedSubmissions.length,
    mvp,
    topUsers: topUsers.slice(0, 10), // Top 10 users
    teamStats,
    mostValuableItem,
    profitPerHour,
    allSubmissions: valuedSubmissions,
  }
}

/**
 * Get comprehensive item statistics for an entire event (all bingos)
 */
export async function getEventItemStatistics(eventId: string): Promise<ItemStatistics> {
  // Get all bingo IDs for this event
  const eventBingos = await db
    .select({ id: bingos.id })
    .from(bingos)
    .where(eq(bingos.eventId, eventId))

  if (eventBingos.length === 0) {
    return {
      totalValue: 0,
      uniqueItemsCount: 0,
      totalSubmissions: 0,
      mvp: null,
      topUsers: [],
      teamStats: [],
      mostValuableItem: null,
      profitPerHour: null,
      allSubmissions: [],
    }
  }

  const bingoIds = eventBingos.map((b) => b.id)

  // Get all approved submissions with item goals for all bingos in this event
  const itemSubmissions = await db
    .select({
      submissionId: submissions.id,
      submittedBy: submissions.submittedBy,
      submissionValue: submissions.submissionValue,
      createdAt: submissions.createdAt,
      userName: users.name,
      runescapeName: users.runescapeName,
      teamId: teams.id,
      teamName: teams.name,
      tileId: tiles.id,
      tileTitle: tiles.title,
      goalId: goals.id,
      targetValue: goals.targetValue,
      itemId: itemGoals.itemId,
      itemBaseName: itemGoals.baseName,
      itemImageUrl: itemGoals.imageUrl,
      submissionStatus: submissions.status,
    })
    .from(submissions)
    .innerJoin(teamTileSubmissions, eq(submissions.teamTileSubmissionId, teamTileSubmissions.id))
    .innerJoin(tiles, eq(teamTileSubmissions.tileId, tiles.id))
    .innerJoin(teams, eq(teamTileSubmissions.teamId, teams.id))
    .innerJoin(users, eq(submissions.submittedBy, users.id))
    .innerJoin(goals, eq(submissions.goalId, goals.id))
    .innerJoin(itemGoals, eq(itemGoals.goalId, goals.id))
    .where(
      and(
        inArray(tiles.bingoId, bingoIds),
        eq(submissions.status, "approved"),
        isNotNull(submissions.goalId),
      ),
    )

  if (itemSubmissions.length === 0) {
    return {
      totalValue: 0,
      uniqueItemsCount: 0,
      totalSubmissions: 0,
      mvp: null,
      topUsers: [],
      teamStats: [],
      mostValuableItem: null,
      profitPerHour: null,
      allSubmissions: [],
    }
  }

  // Extract unique item IDs and fetch prices
  const uniqueItemIds = [...new Set(itemSubmissions.map((s) => s.itemId))]
  const itemPrices = await getItemAveragePrices(uniqueItemIds)

  // Calculate item values for each submission
  const valuedSubmissions: ItemValueSubmission[] = itemSubmissions.map((submission) => {
    const quantity = submission.submissionValue ?? submission.targetValue
    const pricePerItem = itemPrices.get(submission.itemId) ?? 0
    const totalValue = Math.floor(quantity * pricePerItem)

    return {
      submissionId: submission.submissionId,
      userId: submission.submittedBy,
      userName: submission.userName ?? "Unknown",
      runescapeName: submission.runescapeName,
      teamId: submission.teamId,
      teamName: submission.teamName,
      itemId: submission.itemId,
      itemName: submission.itemBaseName,
      itemImageUrl: submission.itemImageUrl,
      quantity,
      pricePerItem,
      totalValue,
      submittedAt: submission.createdAt ?? new Date(),
      tileId: submission.tileId,
      tileTitle: submission.tileTitle,
    }
  })

  // Calculate user statistics (same logic as bingo-level)
  const userStatsMap = new Map<string, UserItemStats>()
  for (const submission of valuedSubmissions) {
    const existing = userStatsMap.get(submission.userId) ?? {
      userId: submission.userId,
      userName: submission.userName,
      runescapeName: submission.runescapeName,
      totalValue: 0,
      itemCount: 0,
      submissionCount: 0,
      mostValuableItem: null,
    }

    existing.totalValue += submission.totalValue
    existing.itemCount += submission.quantity
    existing.submissionCount += 1

    if (!existing.mostValuableItem || submission.totalValue > existing.mostValuableItem.totalValue) {
      existing.mostValuableItem = {
        itemName: submission.itemName,
        itemImageUrl: submission.itemImageUrl,
        totalValue: submission.totalValue,
      }
    }

    userStatsMap.set(submission.userId, existing)
  }

  // Calculate team statistics (same logic as bingo-level)
  const teamStatsMap = new Map<string, TeamItemStats>()
  const teamUserCounts = new Map<string, Set<string>>()

  for (const submission of valuedSubmissions) {
    const existing = teamStatsMap.get(submission.teamId) ?? {
      teamId: submission.teamId,
      teamName: submission.teamName,
      totalValue: 0,
      itemCount: 0,
      submissionCount: 0,
      userCount: 0,
      averageValuePerUser: 0,
      mostValuableItem: null,
    }

    existing.totalValue += submission.totalValue
    existing.itemCount += submission.quantity
    existing.submissionCount += 1

    if (!existing.mostValuableItem || submission.totalValue > existing.mostValuableItem.totalValue) {
      existing.mostValuableItem = {
        itemName: submission.itemName,
        itemImageUrl: submission.itemImageUrl,
        totalValue: submission.totalValue,
      }
    }

    teamStatsMap.set(submission.teamId, existing)

    const teamUsers = teamUserCounts.get(submission.teamId) ?? new Set<string>()
    teamUsers.add(submission.userId)
    teamUserCounts.set(submission.teamId, teamUsers)
  }

  const teamStats: TeamItemStats[] = []
  for (const [teamId, stats] of teamStatsMap.entries()) {
    const userCount = teamUserCounts.get(teamId)?.size ?? 0
    teamStats.push({
      ...stats,
      userCount,
      averageValuePerUser: userCount > 0 ? Math.floor(stats.totalValue / userCount) : 0,
    })
  }

  teamStats.sort((a, b) => b.totalValue - a.totalValue)

  const topUsers = Array.from(userStatsMap.values()).sort((a, b) => b.totalValue - a.totalValue)

  let mvp: MVPStats | null = null
  if (topUsers.length > 0) {
    const topUser = topUsers[0]!
    const userSubmission = valuedSubmissions.find((s) => s.userId === topUser.userId)!

    mvp = {
      userId: topUser.userId,
      userName: topUser.userName,
      runescapeName: topUser.runescapeName,
      teamId: userSubmission.teamId,
      teamName: userSubmission.teamName,
      totalValue: topUser.totalValue,
      itemCount: topUser.itemCount,
      submissionCount: topUser.submissionCount,
      valuePerSubmission: Math.floor(topUser.totalValue / topUser.submissionCount),
    }
  }

  // Calculate most valuable item
  const itemValueMap = new Map<
    number,
    {
      itemId: number
      itemName: string
      itemImageUrl: string
      pricePerItem: number
      totalQuantity: number
      totalValue: number
      obtainedBy: Map<
        string,
        {
          userId: string
          userName: string
          runescapeName: string | null
          teamName: string
          quantity: number
          value: number
        }
      >
    }
  >()

  for (const submission of valuedSubmissions) {
    const existing: {
      itemId: number
      itemName: string
      itemImageUrl: string
      pricePerItem: number
      totalQuantity: number
      totalValue: number
      obtainedBy: Map<
        string,
        {
          userId: string
          userName: string
          runescapeName: string | null
          teamName: string
          quantity: number
          value: number
        }
      >
    } = itemValueMap.get(submission.itemId) ?? {
      itemId: submission.itemId,
      itemName: submission.itemName,
      itemImageUrl: submission.itemImageUrl,
      pricePerItem: submission.pricePerItem,
      totalQuantity: 0,
      totalValue: 0,
      obtainedBy: new Map(),
    }

    existing.totalQuantity += submission.quantity
    existing.totalValue += submission.totalValue

    const userEntry: {
      userId: string
      userName: string
      runescapeName: string | null
      teamName: string
      quantity: number
      value: number
    } = existing.obtainedBy.get(submission.userId) ?? {
      userId: submission.userId,
      userName: submission.userName,
      runescapeName: submission.runescapeName,
      teamName: submission.teamName,
      quantity: 0,
      value: 0,
    }

    userEntry.quantity += submission.quantity
    userEntry.value += submission.totalValue
    existing.obtainedBy.set(submission.userId, userEntry)

    itemValueMap.set(submission.itemId, existing)
  }

  let mostValuableItem: MostValuableItemStats | null = null
  let highestValue = 0

  for (const itemData of itemValueMap.values()) {
    if (itemData.totalValue > highestValue) {
      highestValue = itemData.totalValue
      mostValuableItem = {
        itemId: itemData.itemId,
        itemName: itemData.itemName,
        itemImageUrl: itemData.itemImageUrl,
        pricePerItem: itemData.pricePerItem,
        totalQuantity: itemData.totalQuantity,
        totalValue: itemData.totalValue,
        obtainedByCount: itemData.obtainedBy.size,
        obtainedBy: Array.from(itemData.obtainedBy.values()).sort((a, b) => b.value - a.value),
      }
    }
  }

  // Calculate profit per hour for event
  const profitPerHour = await calculateEventProfitPerHour(eventId, valuedSubmissions)

  const totalValue = valuedSubmissions.reduce((sum, s) => sum + s.totalValue, 0)
  const uniqueItemsCount = uniqueItemIds.length

  return {
    totalValue,
    uniqueItemsCount,
    totalSubmissions: valuedSubmissions.length,
    mvp,
    topUsers: topUsers.slice(0, 10),
    teamStats,
    mostValuableItem,
    profitPerHour,
    allSubmissions: valuedSubmissions,
  }
}

/**
 * Calculate profit per hour for a bingo board
 */
async function calculateBingoProfitPerHour(
  bingoId: string,
  submissions: ItemValueSubmission[],
): Promise<number | null> {
  if (submissions.length === 0) return null

  // Get event dates via bingo
  const bingoData = await db
    .select({
      eventStartDate: events.startDate,
      eventEndDate: events.endDate,
    })
    .from(bingos)
    .innerJoin(events, eq(bingos.eventId, events.id))
    .where(eq(bingos.id, bingoId))
    .limit(1)

  if (bingoData.length === 0 || !bingoData[0]) return null

  const { eventStartDate, eventEndDate } = bingoData[0]
  if (!eventStartDate || !eventEndDate) return null

  // Calculate event duration in hours
  const durationMs = eventEndDate.getTime() - eventStartDate.getTime()
  const durationHours = durationMs / (1000 * 60 * 60)

  if (durationHours <= 0) return null

  // Calculate total value
  const totalValue = submissions.reduce((sum, s) => sum + s.totalValue, 0)

  return Math.floor(totalValue / durationHours)
}

/**
 * Calculate profit per hour for an event
 */
async function calculateEventProfitPerHour(
  eventId: string,
  submissions: ItemValueSubmission[],
): Promise<number | null> {
  if (submissions.length === 0) return null

  // Get event dates
  const eventData = await db.select().from(events).where(eq(events.id, eventId)).limit(1)

  if (eventData.length === 0 || !eventData[0]) return null

  const { startDate, endDate } = eventData[0]
  if (!startDate || !endDate) return null

  // Calculate event duration in hours
  const durationMs = endDate.getTime() - startDate.getTime()
  const durationHours = durationMs / (1000 * 60 * 60)

  if (durationHours <= 0) return null

  // Calculate total value
  const totalValue = submissions.reduce((sum, s) => sum + s.totalValue, 0)

  return Math.floor(totalValue / durationHours)
}

