"use server"

import { db } from "@/server/db"
import { eq, and, inArray } from "drizzle-orm"
import {
  teams,
  teamGoalProgress,
  teamTileSubmissions,
  goals,
  tiles,
  bingos,
  discordWebhooks,
} from "@/server/db/schema"
import { fetchCompetitionFromWOM } from "./wiseoldman"
import { WOMClient } from "@wise-old-man/utils"
import { logger } from "@/lib/logger"
import { checkAndAutoCompleteTile } from "@/app/actions/tile-completion"
import { unstable_noStore as noStore } from "next/cache"
import {
  sendDiscordWebhook,
  createGoalCompleteEmbed,
  createTileCompleteEmbed,
  getTeamHslColor,
  type GoalCompleteEmbedData,
  type TileCompleteEmbedData,
} from "@/lib/discord-webhook"

export async function syncTrackerProgress(bingoId: string) {
  noStore()
  try {
    // 1. Get bingo
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: { event: true },
    })

    if (!bingo) return { success: false, error: "Bingo not found" }
    if (!bingo.womCompetitionId)
      return {
        success: false,
        error: "No WiseOldMan competition linked to this bingo",
      }

    const eventId = bingo.eventId

    // 2. Fetch WOM competition details
    const womResult = await fetchCompetitionFromWOM(bingo.womCompetitionId)
    if (!womResult.success || !womResult.data) {
      return {
        success: false,
        error: womResult.error || "Failed to fetch WOM competition",
      }
    }
    const womComp = womResult.data as {
      startsAt?: Date | string
      endsAt?: Date | string
      participations: {
        teamName?: string
        progress?: { gained?: number }
        player: { username: string }
      }[]
    }

    // 3. Get all metric goals for this bingo
    const eventTilesList = await db
      .select({ id: tiles.id, title: tiles.title, description: tiles.description })
      .from(tiles)
      .where(eq(tiles.bingoId, bingoId))
    if (!eventTilesList.length)
      return { success: false, error: "No tiles found" }

    // Build a lookup map so we can enrich Discord embeds with tile info
    const tileMap = new Map<string, { title: string; description: string | null }>(
      eventTilesList.map((t) => [t.id, { title: t.title, description: t.description }])
    )

    const allGoals = await db.query.goals.findMany({
      where: inArray(
        goals.tileId,
        eventTilesList.map((t) => t.id)
      ),
      with: { metricGoal: true },
    })
    const mGoals = allGoals.filter(
      (g) => g.goalType === "metric" && g.metricGoal
    )

    if (mGoals.length === 0) {
      return { success: true, message: "No metric goals to sync" }
    }

    // 4. Gather participants and fetch individual gains
    const startsAt = womComp.startsAt
      ? new Date(womComp.startsAt)
      : bingo.event.startDate
    let endsAt = womComp.endsAt ? new Date(womComp.endsAt) : new Date()
    if (endsAt > new Date()) {
      endsAt = new Date()
    }

    const uniqueRsns = Array.from(
      new Set(womComp.participations.map((p) => p.player.username))
    )
    const womClient = new WOMClient({ apiKey: process.env.WISEOLDMAN_API_KEY })
    interface WOMGainsData {
      data?: {
        skills?: Record<string, { experience?: { gained?: number } }>
        bosses?: Record<string, { kills?: { gained?: number } }>
        activities?: Record<string, { score?: { gained?: number } }>
        computed?: Record<string, { value?: { gained?: number } }>
      }
    }
    const gainsMap = new Map<string, WOMGainsData>()

    for (let i = 0; i < uniqueRsns.length; i += 5) {
      const chunk = uniqueRsns.slice(i, i + 5)
      await Promise.all(
        chunk.map(async (rsn) => {
          try {
            const gains = await womClient.players.getPlayerGains(rsn, {
              startDate: startsAt.toISOString() as unknown as Date,
              endDate: endsAt.toISOString() as unknown as Date,
            })
            gainsMap.set(rsn, gains)
          } catch (err) {
            logger.warn({ err, rsn }, `Failed to fetch gains for ${rsn}`)
          }
        })
      )

      // Delay between chunks to prevent rate-limiting
      if (i + 5 < uniqueRsns.length) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    function getMetricGain(
      gains: WOMGainsData | undefined,
      metricName: string
    ): number {
      if (!gains || !gains.data) return 0
      const { data } = gains

      if (data.skills && data.skills[metricName]) {
        return data.skills[metricName].experience?.gained || 0
      }
      if (data.bosses && data.bosses[metricName]) {
        return data.bosses[metricName].kills?.gained || 0
      }
      if (data.activities && data.activities[metricName]) {
        return data.activities[metricName].score?.gained || 0
      }
      if (data.computed && data.computed[metricName]) {
        return data.computed[metricName].value?.gained || 0
      }
      return 0
    }

    // 5. Map teams and progress
    const updatedTiles = new Set<string>()

    // Accumulators for Discord notifications — populated during loops, dispatched at the end
    const pendingGoalNotifications: Array<GoalCompleteEmbedData & { progressId: string | undefined }> = []
    const pendingTileNotifications: Array<TileCompleteEmbedData & { submissionId: string | undefined }> = []

    const eventTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, eventId),
      with: {
        teamMembers: {
          with: { 
            user: {
              with: { playerMetadata: true }
            } 
          },
        },
      },
    })

    for (const team of eventTeams) {
      for (const mGoal of mGoals) {
        let gained = 0
        const metricName = mGoal.metricGoal?.metricName
        if (!metricName) continue

        const teamRsns = team.teamMembers.map((tm) => {
          const metadata = tm.user.playerMetadata?.find(pm => pm.eventId === eventId)
          return (metadata?.runescapeNameOverride || tm.user.runescapeName)?.toLowerCase()
        })

        for (const participation of womComp.participations) {
          if (
            participation.teamName === (team.trackerTeamName || team.name) ||
            teamRsns.includes(participation.player.username.toLowerCase())
          ) {
            const rsn = participation.player.username
            const playerGains = gainsMap.get(rsn)
            gained += getMetricGain(playerGains, metricName)
          }
        }

        if (gained > 0) {
          const existingProgress = await db.query.teamGoalProgress.findFirst({
            where: and(
              eq(teamGoalProgress.teamId, team.id),
              eq(teamGoalProgress.goalId, mGoal.id)
            ),
          })

          // Detect first-time goal completion for Discord notification.
          // We skip if notificationSent is already true to prevent repeat pings on re-syncs.
          const prevValue = existingProgress?.currentValue ?? 0
          const wasIncomplete =
            prevValue < mGoal.targetValue && !existingProgress?.notificationSent
          const isNowComplete = gained >= mGoal.targetValue

          if (existingProgress) {
            // Build update payload — mark completedAt on first-time completion
            const setFields = {
              currentValue: gained,
              updatedAt: new Date(),
              ...(wasIncomplete && isNowComplete
                ? { completedAt: new Date(), notificationSent: true }
                : {}),
            }
            await db
              .update(teamGoalProgress)
              .set(setFields)
              .where(eq(teamGoalProgress.id, existingProgress.id))
          } else {
            const isFirstSyncComplete = gained >= mGoal.targetValue
            await db.insert(teamGoalProgress).values({
              teamId: team.id,
              goalId: mGoal.id,
              currentValue: gained,
              ...(isFirstSyncComplete
                ? { completedAt: new Date(), notificationSent: true }
                : {}),
            })
          }

          // Stage a goal-complete notification if this is the first time reaching the target
          if (wasIncomplete && isNowComplete) {
            const tile = tileMap.get(mGoal.tileId)
            pendingGoalNotifications.push({
              teamName: team.name,
              teamColor: getTeamHslColor(team.name),
              tileName: tile?.title ?? "Unknown Tile",
              goalDescription: mGoal.description ?? metricName,
              metricName,
              currentValue: gained,
              targetValue: mGoal.targetValue,
              eventTitle: bingo.event.title,
              bingoTitle: bingo.title,
              progressId: existingProgress?.id,
            })
          }

          updatedTiles.add(`${mGoal.tileId}:${team.id}`)
        }
      }
    }

    for (const item of updatedTiles) {
      const [tileId, teamId] = item.split(":")
      if (tileId && teamId) {
        const result = await checkAndAutoCompleteTile(db, tileId, teamId)

        // Stage a tile-complete notification only when the tile *just* transitioned to completed
        if (result.autoCompleted && (result.wasUpdated ?? result.wasCreated)) {
          // Guard: skip if we already sent a notification for this tile submission
          const submissionId = result.submission?.id
          if (submissionId) {
            const sub = await db.query.teamTileSubmissions.findFirst({
              where: eq(teamTileSubmissions.id, submissionId),
            })
            if (!sub?.notificationSent) {
              const team = eventTeams.find((t) => t.id === teamId)
              const tile = tileMap.get(tileId)
              if (team && tile) {
                pendingTileNotifications.push({
                  teamName: team.name,
                  tileName: tile.title,
                  tileDescription: tile.description,
                  eventTitle: bingo.event.title,
                  bingoTitle: bingo.title,
                  submissionId,
                })
              }
            }
          }
        }
      }
    }

    // Dispatch all accumulated Discord notifications in one batch at the end
    if (pendingGoalNotifications.length > 0 || pendingTileNotifications.length > 0) {
      try {
        const activeWebhooks = await db.query.discordWebhooks.findMany({
          where: and(
            eq(discordWebhooks.eventId, eventId),
            eq(discordWebhooks.isActive, true)
          ),
        })

        if (activeWebhooks.length > 0) {
          const webhookPromises: Promise<boolean>[] = []

          for (const goalData of pendingGoalNotifications) {
            const embed = createGoalCompleteEmbed(goalData)
            for (const webhook of activeWebhooks) {
              webhookPromises.push(
                sendDiscordWebhook(webhook.webhookUrl, { embeds: [embed] })
              )
            }
          }

          for (const tileData of pendingTileNotifications) {
            const embed = createTileCompleteEmbed(tileData)
            for (const webhook of activeWebhooks) {
              webhookPromises.push(
                sendDiscordWebhook(webhook.webhookUrl, { embeds: [embed] })
              )
            }
          }

          const results = await Promise.allSettled(webhookPromises)
          const anySucceeded = results.some(
            (r) => r.status === "fulfilled" && r.value === true
          )

          // Mark notificationSent on tile submissions where the webhook went through
          if (anySucceeded) {
            for (const tileData of pendingTileNotifications) {
              if (tileData.submissionId) {
                await db
                  .update(teamTileSubmissions)
                  .set({ notificationSent: true })
                  .where(eq(teamTileSubmissions.id, tileData.submissionId))
              }
            }
          }
        }
      } catch (discordError) {
        // Discord errors must never fail the tracker sync
        logger.error(
          { error: discordError },
          "Discord webhook error during tracker sync"
        )
      }
    }

    return { success: true, message: "Sync complete" }
  } catch (error) {
    logger.error({ error }, "Error syncing tracker progress:", error)
    return { success: false, error: "Failed to sync tracker progress" }
  }
}

export async function createWiseOldManCompetition(
  bingoId: string,
  metric: string,
  customStartsAt?: Date,
  customEndsAt?: Date
) {
  try {
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: { event: true },
    })

    if (!bingo) return { success: false, error: "Bingo not found" }

    const eventTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, bingo.eventId),
      with: {
        teamMembers: {
          with: { 
            user: {
              with: { playerMetadata: true }
            } 
          },
        },
      },
    })

    const teamsPayload: { name: string; participants: string[] }[] = []
    for (const team of eventTeams) {
      const participants = team.teamMembers
        .map((member) => {
          const metadata = member.user.playerMetadata?.find(pm => pm.eventId === bingo.eventId)
          return metadata?.runescapeNameOverride || member.user.runescapeName
        })
        .filter((name): name is string => name !== null && name !== undefined)

      if (participants.length > 0) {
        teamsPayload.push({
          name: team.trackerTeamName || team.name,
          participants,
        })
      }
    }

    const womClient = new WOMClient({
      apiKey: process.env.WISEOLDMAN_API_KEY,
      userAgent: "Bingoscape/1.0.0",
    })

    const comp = await womClient.competitions.createCompetition({
      title: `${bingo.title} - ${metric}`,
      metric: metric as import("@wise-old-man/utils").Metric,
      startsAt: customStartsAt || bingo.event.startDate,
      endsAt: customEndsAt || bingo.event.endDate,
      teams: teamsPayload,
    })

    await db
      .update(bingos)
      .set({
        womCompetitionId: comp.competition.id,
        womVerificationCode: comp.verificationCode,
      })
      .where(eq(bingos.id, bingoId))

    return { success: true, womCompetitionId: comp.competition.id }
  } catch (error) {
    logger.error({ error }, "Error creating WOM competition:", error)
    return { success: false, error: "Failed to create WOM competition" }
  }
}

export async function linkWiseOldManCompetition(
  bingoId: string,
  competitionId: number,
  verificationCode?: string
) {
  try {
    // Optionally verify that the competition exists
    const womResult = await fetchCompetitionFromWOM(competitionId)
    if (!womResult.success) {
      return { success: false, error: "Competition not found on WiseOldMan" }
    }

    await db
      .update(bingos)
      .set({
        womCompetitionId: competitionId,
        womVerificationCode: verificationCode || null,
      })
      .where(eq(bingos.id, bingoId))

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error linking WOM competition:", error)
    return { success: false, error: "Failed to link WOM competition" }
  }
}

export async function unlinkWiseOldManCompetition(bingoId: string) {
  try {
    await db
      .update(bingos)
      .set({
        womCompetitionId: null,
        womVerificationCode: null,
      })
      .where(eq(bingos.id, bingoId))
    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error unlinking WOM competition:", error)
    return { success: false, error: "Failed to unlink WOM competition" }
  }
}
