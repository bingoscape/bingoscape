"use server"

import { authorize, denial, hasPermission } from "@/server/authz"
import { logger } from "@/lib/logger"
import { db } from "@/server/db"
import {
  assertTeamLimitForBattleship,
  battleshipErrorMessage,
} from "@/server/battleship"
import { teams, eventParticipants, teamMembers } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import {
  simulatedAnnealing,
  type SimulatedAnnealingConfig,
} from "@/lib/team-balancing/annealing"
import {
  DISPLAY_BALANCING_WEIGHTS,
  calculatePlayerScore,
  preparePlayerFeatures,
} from "@/lib/team-balancing/scoring"
import {
  getEventParticipantMetadata,
  calculateMetadataCoverage,
} from "./player-metadata"
import { SA_STANDARD_CONFIG } from "@/lib/simulated-annealing-config"

/**
 * Check if balanced team generation is available for an event
 * Returns true if at least 50% of participants have metadata
 */
export async function canUseBalancedGeneration(
  eventId: string
): Promise<boolean> {
  const coverage = await calculateMetadataCoverage(eventId)
  return coverage >= 50
}

/**
 * Generate balanced teams using simulated annealing optimization
 */
export async function generateBalancedTeams(
  eventId: string,
  config: {
    teamCount?: number
    teamSize?: number
    generationMethod: "teamCount" | "teamSize"
    teamNamePrefix: string
    simulatedAnnealing?: {
      // Basic parameters
      iterations?: number
      initialTemperature?: number
      finalTemperature?: number

      // New: Extended parameters
      randomSeed?: number
      stagnationLimit?: number

      // New: Variance weights (replaces participant weights in SA)
      // Note: Team size is enforced as a hard constraint, not a weight
      skillLevelMapping?: Record<string, number>
      varianceWeights?: {
        timezone?: number
        ehp?: number
        ehb?: number
        dailyHours?: number
        skillLevel?: number
      }

      // New: Move operator probabilities
      moves?: {
        swapProbability?: number
        moveProbability?: number
      }
    }
  }
) {
  const allowed = await authorize(eventId, "team:manage")
  if (!allowed.success) return denial(allowed)

  // Get all event participants
  const allParticipants = await db.query.eventParticipants.findMany({
    where: eq(eventParticipants.eventId, eventId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          runescapeName: true,
          image: true,
        },
      },
    },
  })

  // Get existing teams to find unassigned participants
  const existingTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
    with: {
      teamMembers: {
        with: {
          user: { columns: { id: true, name: true, runescapeName: true } },
        },
      },
    },
  })

  // Filter out already assigned participants
  const assignedUserIds = new Set(
    existingTeams.flatMap((team) =>
      team.teamMembers.map((member) => member.user.id)
    )
  )

  const unassignedParticipants = allParticipants.filter(
    (p) => !assignedUserIds.has(p.user.id)
  )

  if (unassignedParticipants.length === 0) {
    return {
      success: false,
      error: "No unassigned participants to assign to teams",
    }
  }

  // Get metadata for all participants
  const metadata = await getEventParticipantMetadata(eventId)
  const metadataMap = new Map(metadata.map((m) => [m.userId, m]))

  // Calculate number of teams
  const numberOfTeams =
    config.generationMethod === "teamSize" && config.teamSize
      ? Math.ceil(unassignedParticipants.length / config.teamSize)
      : (config.teamCount ?? 2)

  // Prepare player features for simulated annealing
  const playerFeatures = preparePlayerFeatures(
    unassignedParticipants.map((p) => ({ userId: p.user.id })),
    metadataMap as unknown as Parameters<typeof preparePlayerFeatures>[1],
    config.simulatedAnnealing?.skillLevelMapping
  )

  // Configure simulated annealing with standard defaults
  const defaults = SA_STANDARD_CONFIG
  const saConfig: SimulatedAnnealingConfig = {
    // Basic annealing parameters
    iterations:
      config.simulatedAnnealing?.iterations ?? defaults.annealing.iterations,
    initialTemperature:
      config.simulatedAnnealing?.initialTemperature ??
      defaults.annealing.initialTemperature,
    finalTemperature:
      config.simulatedAnnealing?.finalTemperature ??
      defaults.annealing.finalTemperature,

    // Variance weights (use provided or standard defaults)
    // Note: teamSize is now enforced as a hard constraint, not a weight
    varianceWeights: {
      timezone:
        config.simulatedAnnealing?.varianceWeights?.timezone ??
        defaults.weights.timezoneVariance,
      ehp:
        config.simulatedAnnealing?.varianceWeights?.ehp ??
        defaults.weights.averageEHP,
      ehb:
        config.simulatedAnnealing?.varianceWeights?.ehb ??
        defaults.weights.averageEHB,
      dailyHours:
        config.simulatedAnnealing?.varianceWeights?.dailyHours ??
        defaults.weights.averageDailyHours,
      skillLevel:
        config.simulatedAnnealing?.varianceWeights?.skillLevel ??
        (defaults.weights as Record<string, number>).skillLevel ??
        0,
    },

    // New: Extended parameters
    randomSeed: config.simulatedAnnealing?.randomSeed,
    stagnationLimit:
      config.simulatedAnnealing?.stagnationLimit ??
      defaults.termination.stagnationLimit,

    // New: Move operators
    moves: config.simulatedAnnealing?.moves
      ? {
          swapProbability:
            config.simulatedAnnealing.moves.swapProbability ??
            defaults.moves.swapProbability,
          moveProbability:
            config.simulatedAnnealing.moves.moveProbability ??
            defaults.moves.moveProbability,
        }
      : {
          swapProbability: defaults.moves.swapProbability,
          moveProbability: defaults.moves.moveProbability,
        },
  }

  // Run simulated annealing optimization
  const optimizedAssignment = simulatedAnnealing(
    playerFeatures,
    numberOfTeams,
    saConfig
  )

  // Execute bulk inserts inside a transaction
  try {
    await db.transaction(async (tx) => {
      // Battleship events are played by exactly two teams.
      await assertTeamLimitForBattleship(tx, eventId, numberOfTeams)

      // 1. Prepare and insert teams
      const teamInsertData = Array.from({ length: numberOfTeams }).map(
        (_, i) => ({
          eventId,
          name: `${config.teamNamePrefix} ${existingTeams.length + i + 1}`,
        })
      )

      const createdTeams = await tx
        .insert(teams)
        .values(teamInsertData)
        .returning({ id: teams.id })

      // 2. Prepare team members
      const teamMemberInsertData: {
        teamId: string
        userId: string
        eventId: string
        isLeader: boolean
      }[] = []
      for (
        let teamIdx = 0;
        teamIdx < optimizedAssignment.teams.length;
        teamIdx++
      ) {
        const teamUsers = optimizedAssignment.teams[teamIdx]!
        const teamId = createdTeams[teamIdx]!.id

        for (const userId of teamUsers) {
          teamMemberInsertData.push({
            teamId,
            eventId,
            userId,
            isLeader: false,
          })
        }
      }

      // 3. Insert all team members
      if (teamMemberInsertData.length > 0) {
        await tx.insert(teamMembers).values(teamMemberInsertData)
      }
    })

    revalidatePath(`/events/${eventId}`)

    logger.info(
      {
        eventId,
        action: "generateBalancedTeams",
        teamsCreated: numberOfTeams,
        participantsAssigned: unassignedParticipants.length,
        objectiveScore: optimizedAssignment.objective,
        saConfig: {
          iterations: saConfig.iterations,
          varianceWeights: saConfig.varianceWeights,
        },
      },
      "Balanced teams generated successfully"
    )

    return {
      success: true,
      data: {
        teamsCreated: numberOfTeams,
        participantsAssigned: unassignedParticipants.length,
        objectiveScore: optimizedAssignment.objective,
      },
    }
  } catch (error) {
    logger.error({ error }, "Error in generateBalancedTeams")
    return {
      success: false,
      error: battleshipErrorMessage(error, "Failed to generate balanced teams"),
    }
  }
}

/**
 * Calculate balance metrics for existing teams
 */
export async function calculateTeamBalanceMetrics(eventId: string) {
  // Deliberate: a denial reads as null (see guards.ts).
  if (!(await hasPermission(eventId, "stats:read"))) return null

  const existingTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
    with: {
      teamMembers: {
        with: {
          user: { columns: { id: true, name: true, runescapeName: true } },
        },
      },
    },
  })

  if (existingTeams.length === 0) {
    return null
  }

  // Get metadata
  const metadata = await getEventParticipantMetadata(eventId)
  const metadataMap = new Map(metadata.map((m) => [m.userId, m]))

  // Calculate average score per team (using equal weights for display)
  const defaultWeights = DISPLAY_BALANCING_WEIGHTS

  const allMetadata = existingTeams
    .flatMap((t) => t.teamMembers.map((m) => metadataMap.get(m.user.id)))
    .filter((m): m is NonNullable<typeof m> => m !== undefined)

  const teamScores = existingTeams.map((team) => {
    const memberScores = team.teamMembers.map((member) => {
      const userMetadata = metadataMap.get(member.user.id)
      const { score } = userMetadata
        ? calculatePlayerScore(userMetadata, allMetadata, defaultWeights)
        : { score: 0.5 }
      return score
    })

    const averageScore =
      memberScores.length > 0
        ? memberScores.reduce((sum, s) => sum + s, 0) / memberScores.length
        : 0

    return {
      teamId: team.id,
      teamName: team.name,
      memberCount: team.teamMembers.length,
      averageScore,
    }
  })

  // Calculate variance
  const overallAverage =
    teamScores.reduce((sum, t) => sum + t.averageScore, 0) / teamScores.length
  const variance =
    teamScores.reduce(
      (sum, t) => sum + Math.pow(t.averageScore - overallAverage, 2),
      0
    ) / teamScores.length

  return {
    teams: teamScores,
    overallAverage,
    variance,
    standardDeviation: Math.sqrt(variance),
  }
}
