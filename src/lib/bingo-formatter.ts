import { db } from "@/server/db"
import { tiles, teamTileSubmissions, goalGroups, goals, teamGoalProgress } from "@/server/db/schema"
import { eq, asc, and, inArray } from "drizzle-orm"
import { mapStatus } from "@/lib/statusMapping"
import { getProgressionBingoTiles, getTeamTierProgress, getTierXpRequirements } from "@/app/actions/bingo"
import type { GoalTreeNode, GoalNode, GroupNode, GroupProgressData } from "@/types/runelite-api"

export interface FormattedBingo {
  id: string
  title: string
  description: string | null
  rows: number
  columns: number
  codephrase: string | null
  locked: boolean
  visible: boolean
  bingoType: "standard" | "progression"
  tiles: Array<{
    id: string
    title: string
    description: string | null
    headerImage: string | null
    weight: number
    index: number
    tier: number
    isHidden: boolean
    submission: {
      id: string
      status: "pending" | "accepted" | "requires_interaction" | "declined" | "not_submitted"
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
  goals?: Array<{
    id: string
    description: string
    targetValue: number | null
  }>
}

export async function formatBingoData(
  bingo: {
    id: string
    title: string
    description: string | null
    rows: number
    columns: number
    codephrase: string | null
    locked: boolean
    visible: boolean
    bingoType: "standard" | "progression"
  },
  userTeam: {
    id: string
    teamMembers: Array<{
      user: {
        runescapeName: string | null
      }
    }>
  } | null
): Promise<FormattedBingo> {
  // Get tiles based on bingo type - for progressive bingos, filter by unlocked tiers
  let bingoTiles: TileWithGoals[]
  let tierXpRequirements = null
  let tierProgress = null

  if (bingo.bingoType === "progression" && userTeam) {
    // For progression bingo, get only unlocked tiles for the user's team
    bingoTiles = await getProgressionBingoTiles(bingo.id, userTeam.id)
    tierXpRequirements = await getTierXpRequirements(bingo.id)
    tierProgress = await getTeamTierProgress(userTeam.id, bingo.id)
  } else if (bingo.bingoType === "progression" && !userTeam) {
    // No team found - return empty tiles for progression bingo
    bingoTiles = []
  } else {
    // Standard bingo - get all tiles
    bingoTiles = await db.query.tiles.findMany({
      where: eq(tiles.bingoId, bingo.id),
      orderBy: [asc(tiles.index)],
      with: {
        goals: true,
      },
    })
  }

  // Get all team tile submissions for this team
  const teamSubmissions = userTeam
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
  const tileSubmissionMap: Record<string, FormattedBingo["tiles"][0]["submission"]> = {}

  bingoTiles.forEach((tile) => {
    const submission = teamSubmissions.find((sub) => sub.tileId === tile.id)
    tileSubmissionMap[tile.id] = {
      id: tile.id,
      status: submission ? mapStatus(submission.status) : "not_submitted",
      lastUpdated: submission ? submission.updatedAt : null,
      submissionCount: submission?.submissions.length ?? 0,
      ...(submission?.submissions.length
        ? {
          latestSubmission: {
            id: submission.submissions[submission.submissions.length - 1]!.id,
            imageUrl: submission.submissions[submission.submissions.length - 1]!.image.path,
            submittedBy: {
              id: submission.submissions[submission.submissions.length - 1]!.user.id,
              name: submission.submissions[submission.submissions.length - 1]!.user.name,
              runescapeName: submission.submissions[submission.submissions.length - 1]!.user.runescapeName,
            },
            createdAt: submission.submissions[submission.submissions.length - 1]!.createdAt,
          },
        }
        : {}),
    }
  })

  // Build goal trees for all tiles
  const tileGoalTrees = await Promise.all(
    bingoTiles.map((tile) =>
      buildGoalTreeForAPI(tile.id, userTeam?.id ?? null)
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
      submission: tileSubmissionMap[tile.id]!,
      goals:
        tile.goals?.map((goal) => {
          // Calculate progress for current team if available
          const currentTeamSubmission = teamSubmissions.find((sub) => sub.tileId === tile.id)
          const teamSubmissionsForGoal = currentTeamSubmission?.submissions.filter(sub => sub.goalId === goal.id) ?? []

          const approvedProgress = teamSubmissionsForGoal
            .filter(sub => sub.status === "approved")
            .reduce((sum, sub) => sum + (sub.submissionValue ?? 0), 0)
          const totalProgress = teamSubmissionsForGoal
            .reduce((sum, sub) => sum + (sub.submissionValue ?? 0), 0)

          const approvedPercentage = goal.targetValue && goal.targetValue > 0 ? Math.min(100, (approvedProgress / goal.targetValue) * 100) : 0
          const isCompleted = goal.targetValue ? approvedProgress >= goal.targetValue : false

          return {
            id: goal.id,
            description: goal.description,
            targetValue: goal.targetValue,
            progress: userTeam ? {
              approvedProgress,
              totalProgress,
              approvedPercentage,
              isCompleted,
            } : undefined,
          }
        }) ?? [],
      goalTree: goalTreeMap[tile.id] ?? [],
    })),
    // Include progression bingo metadata when applicable
    ...(bingo.bingoType === "progression" && userTeam && {
      progression: {
        tierXpRequirements: tierXpRequirements?.map(req => ({
          tier: req.tier,
          xpRequired: req.xpRequired,
        })) ?? [],
        unlockedTiers: tierProgress?.filter(tp => tp.isUnlocked).map(tp => tp.tier) ?? [],
        tierProgress: tierProgress?.map(tp => ({
          tier: tp.tier,
          isUnlocked: tp.isUnlocked,
          unlockedAt: tp.unlockedAt,
        })) ?? [],
      }
    })
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
          groupNode.progress = calculateGroupProgress(groupNode, allGoals, teamProgressMap)
        }

        nodes.push(groupNode)
      }

      // Add goals at this level
      const childGoals = allGoals
        .filter((g) => g.parentGroupId === parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex)

      for (const goal of childGoals) {
        const goalNode: GoalNode = formatGoalNode(goal, teamProgressMap, teamId !== null)
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
    goalType: "generic" | "item"
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
  if (includeProgress) {
    const currentValue = teamProgressMap.get(goal.id) ?? 0
    const isCompleted = currentValue >= goal.targetValue
    const percentage = goal.targetValue > 0
      ? Math.min(100, (currentValue / goal.targetValue) * 100)
      : 0

    goalNode.progress = {
      approvedProgress: currentValue,
      totalProgress: currentValue,
      approvedPercentage: percentage,
      isCompleted,
    }
  }

  return goalNode
}

/**
 * Calculate aggregated progress for a goal group
 */
function calculateGroupProgress(
  groupNode: GroupNode,
  allGoals: Array<{ id: string; targetValue: number }>,
  teamProgressMap: Map<string, number>
): GroupProgressData {
  let completedCount = 0
  let totalCount = 0

  // Recursively count completed children
  function countCompletedChildren(node: GoalTreeNode): boolean {
    if (node.type === "goal") {
      totalCount++
      const currentValue = teamProgressMap.get(node.id) ?? 0
      const isComplete = currentValue >= node.targetValue!
      if (isComplete) {
        completedCount++
      }
      return isComplete
    } else {
      // For groups, evaluate based on their logical operator
      const childResults = node.children.map(countCompletedChildren)

      if (node.logicalOperator === "AND") {
        // AND: all children must be complete
        return childResults.every((result) => result)
      } else {
        // OR: at least minRequiredGoals children must be complete
        const completedChildren = childResults.filter((result) => result).length
        return completedChildren >= node.minRequiredGoals
      }
    }
  }

  // Evaluate the group
  const isComplete = groupNode.children.length > 0
    ? (() => {
        const childResults = groupNode.children.map(countCompletedChildren)

        if (groupNode.logicalOperator === "AND") {
          return childResults.every((result) => result)
        } else {
          const completedChildren = childResults.filter((result) => result).length
          return completedChildren >= groupNode.minRequiredGoals
        }
      })()
    : false

  return {
    completedCount,
    totalCount,
    isComplete,
  }
}
