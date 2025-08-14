import { db } from "@/server/db"
import { tiles, teamTileSubmissions } from "@/server/db/schema"
import { eq, asc } from "drizzle-orm"
import { mapStatus } from "@/lib/statusMapping"
import { getProgressionBingoTiles, getTeamTierProgress, getTierXpRequirements } from "@/app/actions/bingo"

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
