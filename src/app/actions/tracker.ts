"use server"

import { db } from "@/server/db"
import { eq, and, inArray } from "drizzle-orm"
import { 
  events, 
  teams, 
  teamMembers, 
  users, 
  teamGoalProgress, 
  metricGoals, 
  goals,
  teamTileSubmissions,
  tiles,
  bingos
} from "@/server/db/schema"
import { fetchCompetitionFromWOM } from "./wiseoldman"
import { logger } from "@/lib/logger"

export async function syncTrackerProgress(eventId: string) {
  try {
    // 1. Get event and its tracker configuration
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    })

    if (!event) return { success: false, error: "Event not found" }
    if (!event.trackerCompetitionId) return { success: false, error: "No tracker competition linked to this event" }
    
    if (event.trackerProvider !== "wiseoldman") {
      return { success: false, error: "Only WiseOldMan is currently supported" }
    }

    // 2. Fetch WOM competition details
    const womResult = await fetchCompetitionFromWOM(event.trackerCompetitionId)
    if (!womResult.success || !womResult.data) {
      return { success: false, error: womResult.error || "Failed to fetch WOM competition" }
    }
    const womComp = womResult.data

    // 3. Get all metric goals for this event
    const eventBingos = await db.select({ id: bingos.id }).from(bingos).where(eq(bingos.eventId, eventId))
    if (!eventBingos.length) return { success: false, error: "No bingos found for this event" }
    
    const eventTilesList = await db.select({ id: tiles.id }).from(tiles).where(inArray(tiles.bingoId, eventBingos.map(b => b.id)))
    if (!eventTilesList.length) return { success: false, error: "No tiles found" }

    const allGoals = await db.query.goals.findMany({
      where: inArray(goals.tileId, eventTilesList.map(t => t.id)),
      with: { metricGoal: true }
    })
    const mGoals = allGoals.filter(g => g.goalType === "metric" && g.metricGoal)

    if (mGoals.length === 0) {
      return { success: true, message: "No metric goals to sync" }
    }

    // 4. Map teams and progress
    const eventTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, eventId),
      with: {
        teamMembers: {
          with: { user: true }
        }
      }
    })

    for (const team of eventTeams) {
      const playerNames = team.teamMembers.map(tm => tm.user.runescapeName?.toLowerCase()).filter(Boolean) as string[]
      
      for (const mGoal of mGoals) {
        let gained = 0

        for (const participation of womComp.participations) {
          if (participation.player && playerNames.includes(participation.player.displayName.toLowerCase())) {
             // Basic implementation uses overall gained XP from competition.
             // In a robust solution, we'd filter the specific metric tracked by the goal.
             gained += (participation.progress?.gained || 0)
          }
        }

        if (gained > 0) {
          const existingProgress = await db.query.teamGoalProgress.findFirst({
            where: and(
              eq(teamGoalProgress.teamId, team.id),
              eq(teamGoalProgress.goalId, mGoal.id)
            )
          })

          if (existingProgress) {
            await db.update(teamGoalProgress)
              .set({ currentValue: gained, updatedAt: new Date() })
              .where(eq(teamGoalProgress.id, existingProgress.id))
          } else {
            await db.insert(teamGoalProgress).values({
              teamId: team.id,
              goalId: mGoal.id,
              currentValue: gained
            })
          }

          if (gained >= mGoal.targetValue) {
            const existingSub = await db.query.teamTileSubmissions.findFirst({
              where: and(
                eq(teamTileSubmissions.tileId, mGoal.tileId),
                eq(teamTileSubmissions.teamId, team.id)
              )
            })

            if (existingSub) {
              await db.update(teamTileSubmissions)
                .set({ status: "approved", updatedAt: new Date() })
                .where(eq(teamTileSubmissions.id, existingSub.id))
            } else {
              await db.insert(teamTileSubmissions).values({
                tileId: mGoal.tileId,
                teamId: team.id,
                status: "approved"
              })
            }
          }
        }
      }
    }

    return { success: true, message: "Sync complete" }
  } catch (error) {
    logger.error({ error }, "Error syncing tracker progress:", error)
    return { success: false, error: "Failed to sync tracker progress" }
  }
}
