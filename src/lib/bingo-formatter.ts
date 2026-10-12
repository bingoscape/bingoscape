import { db } from "@/server/db"
import {
  events,
  tiles,
  teamTileSubmissions,
  goalGroups,
  goals,
  teamGoalProgress,
  eventParticipants,
  type BingoType,
} from "@/server/db/schema"
import { eq, asc, and, inArray } from "drizzle-orm"
import { applyBlindBoard, isBlindBoard } from "@/server/blind-board"
import { getBattleshipTeamSummary } from "@/server/battleship"
import { mapStatus } from "@/lib/statusMapping"
import {
  getTierEarnedXp,
  getTierXpRequired,
  getUnlockedTiers,
} from "@/lib/tiers"
import { getProgressionBingoTiles, getTeamTierProgress, getTierXpRequirements } from "@/app/actions/bingo"
import type {
  GoalTreeNode,
  GoalNode,
  GroupNode,
  GroupProgressData,
} from "@/types/runelite-api"

export interface FormattedBingo {
  id: string
  title: string
  description: string | null
  rows: number
  columns: number
  codephrase: string | null
  locked: boolean
  visible: boolean
  bingoType: BingoType
  tiles: Array<{
    id: string
    title: string
    description: string | null
    headerImage: string | null
    weight: number
    index: number
    tier: number
    isHidden: boolean
    /**
     * Progression boards: the Team has not unlocked this Tile's Tier. The Tile
     * is then a stub: id, index and tier are real, everything else is a
     * neutral default (no title, description, image, goals or weight).
     */
    tierLocked: boolean
    /**
     * Battleship boards before the event starts, for a viewer who does not
     * manage the event: the Tile's content is redacted (placeholder title, no
     * description, image, goals, weight or progress). Always false otherwise.
     */
    isBlind: boolean
    submission: {
      id: string
      status:
        | "pending"
        | "accepted"
        | "requires_interaction"
        | "declined"
        | "not_submitted"
      lastUpdated: Date | null
      submissionCount: number
      latestSubmission?: {
        id: string
        imageUrl: string
        submittedBy: {
          id: string
          name: string | null
          runescapeName: string | null
        }
        createdAt: Date
      }
    }
    goals: Array<{
      id: string
      description: string
      targetValue: number | null
      progress?: {
        approvedProgress: number
        totalProgress: number
        approvedPercentage: number
        isCompleted: boolean
      }
    }>
    goalTree: GoalTreeNode[]
  }>
  progression?: {
    tierXpRequirements: Array<{
      tier: number
      xpRequired: number
    }>
    unlockedTiers: number[]
    tierProgress: Array<{
      tier: number
      isUnlocked: boolean
      unlockedAt: Date | null
    }>
    /** Every Tier of the Board, locked ones included. */
    tiers: Array<{
      tier: number
      isUnlocked: boolean
      unlockedAt: Date | null
      /** XP the Team earned from completed Tiles of this Tier. */
      earnedXp: number
      /** XP needed in this Tier to unlock the next one. */
      xpRequired: number
    }>
  }
  /** Only on battleship boards; always about the caller's own team. */
  battleship?: {
    started: boolean
    startDate: Date
    serverNow: Date
    rules: Array<{ length: number; count: number }>
    /** Hits, misses and sunk ships of the caller's team; empty before the start. */
    marks: {
      hitTileIds: string[]
      missTileIds: string[]
      sunkTileIds: string[]
    }
    /** Counts only: no position of an opponent ship ever leaves the server. */
    opponentShipsSunk: number
    opponentShipsTotal: number
  }
}

interface TileWithGoals {
  id: string
  title: string
  description: string | null
  headerImage: string | null
  weight: number
  index: number
  tier: number
  isHidden: boolean
  tierLocked?: boolean
  isBlind?: boolean
  teamTileSubmissions?: Array<{ teamId: string; status: string }>
  goals?: Array<{
    id: string
    description: string
    targetValue: number | null
  }>
}

/**
 * What a Team may see of a Tile in a Tier it has not unlocked: its place on
 * the Board and nothing else.
 */
function toLockedStub(tile: TileWithGoals): TileWithGoals {
  return {
    id: tile.id,
    title: "",
    description: null,
    headerImage: null,
    weight: 0,
    index: tile.index,
    tier: tile.tier,
    isHidden: false,
    tierLocked: true,
    goals: [],
  }
}

/**
 * Who the board is formatted for: the RuneLite API key's user. Decides whether
 * a blind battleship board is redacted (managers see it unredacted).
 */
export interface BingoViewer {
  userId: string
}

/** The event's start date and whether the viewer manages it. */
async function loadEventViewerContext(eventId: string, userId: string) {
  const [event, participant] = await Promise.all([
    db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: { startDate: true, creatorId: true },
    }),
    db.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.userId, userId)
      ),
      columns: { role: true },
    }),
  ])
  if (!event) return null
  return {
    startDate: event.startDate,
    isManager:
      event.creatorId === userId ||
      participant?.role === "admin" ||
      participant?.role === "management",
  }
}

export async function formatBingoData(
  bingo: {
    id: string
    eventId: string
    title: string
    description: string | null
    rows: number
    columns: number
    codephrase: string | null
    locked: boolean
    visible: boolean
    bingoType: BingoType
  },
  userTeam: {
    id: string
    teamMembers: Array<{
      user: {
        runescapeName: string | null
      }
    }>
  } | null,
  viewer: BingoViewer
): Promise<FormattedBingo> {
  const eventContext =
    bingo.bingoType === "battleship"
      ? await loadEventViewerContext(bingo.eventId, viewer.userId)
      : null
  // Unknown event: redact, never the other way around.
  const blind = eventContext
    ? isBlindBoard({
        bingoType: bingo.bingoType,
        startDate: eventContext.startDate,
        isManager: eventContext.isManager,
      })
    : bingo.bingoType === "battleship"

  // Get tiles based on bingo type - for progressive bingos, filter by unlocked tiers
  let bingoTiles: TileWithGoals[]
  let tierXpRequirements = null
  let tierProgress = null
  const unlockedTiers = new Set<number>()
  // Progression Tiles of every Tier, with their completions, for the tier summary.
  let allProgressionTiles: TileWithGoals[] = []

  if (bingo.bingoType === "progression" && userTeam) {
    // For progression bingo, locked Tiers come back too, as content-free stubs
    allProgressionTiles = await getProgressionBingoTiles(bingo.id, userTeam.id, {
      includeLocked: true,
    })
    bingoTiles = allProgressionTiles.map((tile) =>
      tile.tierLocked ? toLockedStub(tile) : tile
    )
    tierXpRequirements = await getTierXpRequirements(bingo.id)
    tierProgress = await getTeamTierProgress(userTeam.id, bingo.id)
    for (const tier of getUnlockedTiers(tierProgress)) unlockedTiers.add(tier)
  } else if (bingo.bingoType === "progression" && !userTeam) {
    // No team found - return empty tiles for progression bingo
    bingoTiles = []
  } else {
    // Standard bingo - get all tiles
    bingoTiles = applyBlindBoard(
      await db.query.tiles.findMany({
        where: eq(tiles.bingoId, bingo.id),
        orderBy: [asc(tiles.index)],
        with: {
          goals: true,
        },
      }),
      blind
    )
  }

  // Get all team tile submissions for this team. A blind board shows none:
  // their status, images and goal progress would give the Tiles away.
  const teamSubmissions = userTeam && !blind
    ? await db.query.teamTileSubmissions.findMany({
        where: eq(teamTileSubmissions.teamId, userTeam.id),
        with: {
          submissions: {
            with: {
              image: true,
              user: {
                columns: {
                  id: true,
                  name: true,
                  runescapeName: true,
                },
              },
            },
          },
        },
      })
    : []

  // Create a map of tile IDs to submission data
  const tileSubmissionMap: Record<
    string,
    FormattedBingo["tiles"][0]["submission"]
  > = {}

  bingoTiles.forEach((tile) => {
    const submission = tile.tierLocked
      ? undefined
      : teamSubmissions.find((sub) => sub.tileId === tile.id)
    tileSubmissionMap[tile.id] = {
      id: tile.id,
      status: submission ? mapStatus(submission.status) : "not_submitted",
      lastUpdated: submission ? submission.updatedAt : null,
      submissionCount: submission?.submissions.length ?? 0,
      ...(submission?.submissions.length
        ? {
            latestSubmission: {
              id: submission.submissions[submission.submissions.length - 1]!.id,
              imageUrl:
                submission.submissions[submission.submissions.length - 1]!.image
                  .path,
              submittedBy: {
                id: submission.submissions[submission.submissions.length - 1]!
                  .user.id,
                name: submission.submissions[submission.submissions.length - 1]!
                  .user.name,
                runescapeName:
                  submission.submissions[submission.submissions.length - 1]!
                    .user.runescapeName,
              },
              createdAt:
                submission.submissions[submission.submissions.length - 1]!
                  .createdAt,
            },
          }
        : {}),
    }
  })

  // Build goal trees for all tiles
  const tileGoalTrees = await Promise.all(
    bingoTiles.map((tile) =>
      tile.tierLocked || tile.isBlind
        ? Promise.resolve([] as GoalTreeNode[])
        : buildGoalTreeForAPI(tile.id, userTeam?.id ?? null)
    )
  )

  // Create a map of tile IDs to goal trees
  const goalTreeMap: Record<string, GoalTreeNode[]> = {}
  bingoTiles.forEach((tile, index) => {
    goalTreeMap[tile.id] = tileGoalTrees[index]!
  })

  // Format the bingo data
  const formattedBingo: FormattedBingo = {
    id: bingo.id,
    title: bingo.title,
    description: bingo.description,
    rows: bingo.rows,
    columns: bingo.columns,
    codephrase: bingo.codephrase,
    locked: bingo.locked,
    visible: bingo.visible,
    bingoType: bingo.bingoType,
    tiles: bingoTiles.map((tile) => ({
      id: tile.id,
      title: tile.title,
      description: tile.description,
      headerImage: tile.headerImage,
      weight: tile.weight,
      index: tile.index,
      tier: tile.tier,
      isHidden: tile.isHidden,
      tierLocked: tile.tierLocked ?? false,
      isBlind: tile.isBlind ?? false,
      submission: tileSubmissionMap[tile.id]!,
      goals:
        tile.goals?.map((goal) => {
          // Calculate progress for current team if available
          const currentTeamSubmission = teamSubmissions.find(
            (sub) => sub.tileId === tile.id
          )
          const teamSubmissionsForGoal =
            currentTeamSubmission?.submissions.filter(
              (sub) => sub.goalId === goal.id
            ) ?? []

          const rawApprovedProgress = teamSubmissionsForGoal
            .filter((sub) => sub.status === "approved")
            .reduce((sum, sub) => sum + (sub.submissionValue ?? 0), 0)
          const rawTotalProgress = teamSubmissionsForGoal.reduce(
            (sum, sub) => sum + (sub.submissionValue ?? 0),
            0
          )

          const approvedProgress = Math.floor(rawApprovedProgress)
          const totalProgress = Math.floor(rawTotalProgress)

          const approvedPercentage =
            goal.targetValue && goal.targetValue > 0
              ? Math.min(
                  100,
                  Math.round((rawApprovedProgress / goal.targetValue) * 100)
                )
              : 0
          const isCompleted = goal.targetValue
            ? rawApprovedProgress >= goal.targetValue
            : false

          return {
            id: goal.id,
            description: goal.description,
            targetValue: goal.targetValue,
            progress: userTeam
              ? {
                  approvedProgress,
                  totalProgress,
                  approvedPercentage,
                  isCompleted,
                }
              : undefined,
          }
        }) ?? [],
      goalTree: goalTreeMap[tile.id] ?? [],
    })),
    // Include progression bingo metadata when applicable
    ...(bingo.bingoType === "progression" &&
      userTeam && {
        progression: {
          tierXpRequirements:
            tierXpRequirements?.map((req) => ({
              tier: req.tier,
              xpRequired: req.xpRequired,
            })) ?? [],
          // Tier 0 is unlocked even before the Team has any tier rows.
          unlockedTiers: [...unlockedTiers].sort((a, b) => a - b),
          tierProgress:
            tierProgress?.map((tp) => ({
              tier: tp.tier,
              isUnlocked: tp.isUnlocked,
              unlockedAt: tp.unlockedAt,
            })) ?? [],
          tiers: [...new Set(allProgressionTiles.map((t) => t.tier))]
            .sort((a, b) => a - b)
            .map((tier) => ({
              tier,
              isUnlocked: unlockedTiers.has(tier),
              unlockedAt:
                tierProgress?.find((tp) => tp.tier === tier)?.unlockedAt ??
                null,
              earnedXp: getTierEarnedXp(
                allProgressionTiles.map((t) => ({
                  id: t.id,
                  tier: t.tier,
                  weight: t.weight,
                  index: t.index,
                  teamTileSubmissions: t.teamTileSubmissions,
                })),
                userTeam.id,
                tier
              ),
              xpRequired: getTierXpRequired(
                (tierXpRequirements ?? []).map((r) => ({
                  tier: r.tier,
                  xpRequired: r.xpRequired,
                })),
                tier
              ),
            })),
        },
      }),
  }

  if (bingo.bingoType === "battleship" && eventContext) {
    const summary = await getBattleshipTeamSummary({
      bingoId: bingo.id,
      teamId: userTeam?.id ?? null,
      startDate: eventContext.startDate,
    })
    formattedBingo.battleship = {
      started: summary.started,
      startDate: summary.startDate,
      serverNow: new Date(),
      rules: summary.rules.map((rule) => ({
        length: rule.length,
        count: rule.count,
      })),
      marks: summary.marks,
      opponentShipsSunk: summary.opponentShipsSunk,
      opponentShipsTotal: summary.opponentShipsTotal,
    }
  }

  return formattedBingo
}

/**
 * Build hierarchical goal tree for API response
 * @param tileId - The tile ID to get goals for
 * @param teamId - The team ID to calculate progress for (optional)
 * @returns Promise<GoalTreeNode[]> - Hierarchical goal tree with progress
 */
export async function buildGoalTreeForAPI(
  tileId: string,
  teamId: string | null
): Promise<GoalTreeNode[]> {
  try {
    // Fetch all groups for this tile
    const allGroups = await db.query.goalGroups.findMany({
      where: eq(goalGroups.tileId, tileId),
    })

    // Fetch all goals for this tile with their related data
    const allGoals = await db.query.goals.findMany({
      where: eq(goals.tileId, tileId),
      with: {
        goalValues: true,
        itemGoal: true,
      },
    })

    // Fetch team progress if teamId provided
    const teamProgressMap = new Map<string, number>()
    if (teamId && allGoals.length > 0) {
      const goalIds = allGoals.map((g) => g.id)
      const progressData = await db.query.teamGoalProgress.findMany({
        where: and(
          eq(teamGoalProgress.teamId, teamId),
          inArray(teamGoalProgress.goalId, goalIds)
        ),
      })

      progressData.forEach((progress) => {
        teamProgressMap.set(progress.goalId, progress.currentValue)
      })
    }

    // Build tree structure recursively
    const buildTree = (parentId: string | null): GoalTreeNode[] => {
      const nodes: GoalTreeNode[] = []

      // Add groups at this level
      const childGroups = allGroups
        .filter((g) => g.parentGroupId === parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex)

      for (const group of childGroups) {
        const children = buildTree(group.id)
        const groupNode: GroupNode = {
          type: "group",
          id: group.id,
          orderIndex: group.orderIndex,
          name: group.name,
          logicalOperator: group.logicalOperator,
          minRequiredGoals: group.minRequiredGoals,
          children,
        }

        // Calculate group progress if team provided
        if (teamId) {
          groupNode.progress = calculateGroupProgress(
            groupNode,
            allGoals,
            teamProgressMap
          )
        }

        nodes.push(groupNode)
      }

      // Add goals at this level
      const childGoals = allGoals
        .filter((g) => g.parentGroupId === parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex)

      for (const goal of childGoals) {
        const goalNode: GoalNode = formatGoalNode(
          goal,
          teamProgressMap,
          teamId !== null
        )
        nodes.push(goalNode)
      }

      return nodes
    }

    return buildTree(null)
  } catch (error) {
    console.error("Error building goal tree for API:", error)
    return []
  }
}

/**
 * Format a single goal node with all metadata
 */
function formatGoalNode(
  goal: {
    id: string
    description: string
    targetValue: number
    goalType: "generic" | "item" | "metric"
    orderIndex: number
    itemGoal?: {
      itemId: number
      baseName: string
      exactVariant: string | null
      imageUrl: string
    } | null
    goalValues?: Array<{
      id: string
      value: number
      description: string
    }>
  },
  teamProgressMap: Map<string, number>,
  includeProgress: boolean
): GoalNode {
  const goalNode: GoalNode = {
    type: "goal",
    id: goal.id,
    orderIndex: goal.orderIndex,
    description: goal.description,
    targetValue: goal.targetValue,
    goalType: goal.goalType,
  }

  // Add item goal metadata if present
  if (goal.itemGoal) {
    goalNode.itemGoal = {
      itemId: goal.itemGoal.itemId,
      baseName: goal.itemGoal.baseName,
      exactVariant: goal.itemGoal.exactVariant,
      imageUrl: goal.itemGoal.imageUrl,
    }
  }

  // Add goal values if present
  if (goal.goalValues && goal.goalValues.length > 0) {
    goalNode.goalValues = goal.goalValues.map((gv) => ({
      id: gv.id,
      value: gv.value,
      description: gv.description,
    }))
  }

  // Add progress if team context provided
  // Use completedCount/totalCount/isComplete to match Java model
  if (includeProgress) {
    const currentValue = teamProgressMap.get(goal.id) ?? 0
    const isComplete = currentValue >= goal.targetValue

    goalNode.progress = {
      completedCount: Math.floor(currentValue),
      totalCount: goal.targetValue,
      isComplete,
    }
  }

  return goalNode
}

/**
 * Calculate aggregated progress for a goal group
 * For display purposes:
 * - completedCount: number of immediate children that are complete
 * - totalCount: for OR groups, use minRequiredGoals; for AND groups, use total children
 * - isComplete: whether the group requirements are met
 */
export function calculateGroupProgress(
  groupNode: GroupNode,
  allGoals: Array<{ id: string; targetValue: number }>,
  teamProgressMap: Map<string, number>
): GroupProgressData {
  // Check if each immediate child is complete and its numerical progress
  function getChildProgress(node: GoalTreeNode): {
    isComplete: boolean
    currentValue: number
  } {
    if (node.type === "goal") {
      const currentValue = teamProgressMap.get(node.id) ?? 0
      return {
        isComplete: currentValue >= node.targetValue!,
        currentValue,
      }
    } else {
      // For nested groups, recursively evaluate based on their logical operator
      const childResults = node.children.map(getChildProgress)

      let isComplete = false
      let currentValue = 0

      if (node.logicalOperator === "AND") {
        isComplete = childResults.every((result) => result.isComplete)
        currentValue = isComplete ? 1 : 0
      } else if (node.logicalOperator === "OR") {
        const completedChildren = childResults.filter(
          (result) => result.isComplete
        ).length
        isComplete = completedChildren >= node.minRequiredGoals
        currentValue = isComplete ? 1 : 0
      } else {
        // SUM operator uses pooled sum logic
        for (let i = 0; i < node.children.length; i++) {
          const childNode = node.children[i]!
          const result = childResults[i]!
          if (childNode.type === "goal") {
            currentValue += result.currentValue
          } else {
            currentValue += result.isComplete ? 1 : 0
          }
        }
        isComplete = currentValue >= node.minRequiredGoals
      }

      return { isComplete, currentValue }
    }
  }

  // Get progress results for all immediate children
  const childResults = groupNode.children.map(getChildProgress)
  const completedCount = childResults.filter(
    (result) => result.isComplete
  ).length

  let totalCount: number
  let calculatedCompletedCount: number
  let isComplete: boolean

  if (groupNode.logicalOperator === "AND") {
    // AND: all children must be complete
    totalCount = groupNode.children.length
    calculatedCompletedCount = completedCount
    isComplete = calculatedCompletedCount === totalCount
  } else if (groupNode.logicalOperator === "OR") {
    // OR: only minRequiredGoals need to be complete
    totalCount = Math.min(groupNode.minRequiredGoals, groupNode.children.length)
    calculatedCompletedCount = completedCount
    isComplete = calculatedCompletedCount >= groupNode.minRequiredGoals
  } else {
    // SUM: sum uncapped goal progress and boolean group completions
    totalCount = groupNode.minRequiredGoals
    calculatedCompletedCount = 0
    for (let i = 0; i < groupNode.children.length; i++) {
      const childNode = groupNode.children[i]!
      const result = childResults[i]!
      if (childNode.type === "goal") {
        calculatedCompletedCount += result.currentValue
      } else {
        calculatedCompletedCount += result.isComplete ? 1 : 0
      }
    }
    isComplete = calculatedCompletedCount >= totalCount
  }

  return {
    completedCount: Math.floor(calculatedCompletedCount),
    totalCount,
    isComplete,
  }
}
