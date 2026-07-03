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
import { WOMClient } from "@wise-old-man/utils"
import { logger } from "@/lib/logger"
import { checkAndAutoCompleteTile } from "@/app/actions/tile-completion"

export async function syncTrackerProgress(bingoId: string) {
  try {
    // 1. Get bingo
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: { event: true }
    })

    if (!bingo) return { success: false, error: "Bingo not found" }
    if (!bingo.womCompetitionId) return { success: false, error: "No WiseOldMan competition linked to this bingo" }

    const eventId = bingo.eventId;

    // 2. Fetch WOM competition details
    const womResult = await fetchCompetitionFromWOM(bingo.womCompetitionId)
    if (!womResult.success || !womResult.data) {
      return { success: false, error: womResult.error || "Failed to fetch WOM competition" }
    }
    const womComp = womResult.data as { 
      startsAt?: Date | string; 
      endsAt?: Date | string; 
      participations: { teamName?: string; progress?: { gained?: number }; player: { username: string } }[] 
    }

    // 3. Get all metric goals for this bingo
    const eventTilesList = await db.select({ id: tiles.id }).from(tiles).where(eq(tiles.bingoId, bingoId))
    if (!eventTilesList.length) return { success: false, error: "No tiles found" }

    const allGoals = await db.query.goals.findMany({
      where: inArray(goals.tileId, eventTilesList.map(t => t.id)),
      with: { metricGoal: true }
    })
    const mGoals = allGoals.filter(g => g.goalType === "metric" && g.metricGoal)

    if (mGoals.length === 0) {
      return { success: true, message: "No metric goals to sync" }
    }

    // 4. Gather participants and fetch individual gains
    const startsAt = womComp.startsAt ? new Date(womComp.startsAt) : bingo.event.startDate;
    let endsAt = womComp.endsAt ? new Date(womComp.endsAt) : new Date();
    if (endsAt > new Date()) {
      endsAt = new Date();
    }

    const uniqueRsns = Array.from(new Set(womComp.participations.map(p => p.player.username)));
    const womClient = new WOMClient({ apiKey: process.env.WISEOLDMAN_API_KEY });
    const gainsMap = new Map<string, any>();

    for (let i = 0; i < uniqueRsns.length; i += 5) {
      const chunk = uniqueRsns.slice(i, i + 5);
      await Promise.all(chunk.map(async (rsn) => {
        try {
          const gains = await womClient.players.getPlayerGains(rsn, { startDate: startsAt, endDate: endsAt });
          gainsMap.set(rsn, gains);
        } catch (err) {
          logger.warn({ err, rsn }, `Failed to fetch gains for ${rsn}`);
        }
      }));
    }

    function getMetricGain(gains: any, metricName: string): number {
      if (!gains || !gains.data) return 0;
      const { data } = gains;
      
      if (data.skills && data.skills[metricName]) {
        return data.skills[metricName].experience?.gained || 0;
      }
      if (data.bosses && data.bosses[metricName]) {
        return data.bosses[metricName].kills?.gained || 0;
      }
      if (data.activities && data.activities[metricName]) {
        return data.activities[metricName].score?.gained || 0;
      }
      if (data.computed && data.computed[metricName]) {
        return data.computed[metricName].value?.gained || 0;
      }
      return 0;
    }

    // 5. Map teams and progress
    const updatedTiles = new Set<string>();

    const eventTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, eventId),
      with: {
        teamMembers: {
          with: { user: true }
        }
      }
    })

    for (const team of eventTeams) {
      for (const mGoal of mGoals) {
        let gained = 0
        const metricName = mGoal.metricGoal?.metricName;
        if (!metricName) continue;

        const teamRsns = team.teamMembers.map(tm => tm.user.runescapeName?.toLowerCase());

        for (const participation of womComp.participations) {
          if (participation.teamName === (team.trackerTeamName || team.name) || 
              teamRsns.includes(participation.player.username.toLowerCase())) {
             
             const rsn = participation.player.username;
             const playerGains = gainsMap.get(rsn);
             gained += getMetricGain(playerGains, metricName);
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

          updatedTiles.add(`${mGoal.tileId}:${team.id}`);
        }
      }
    }

    for (const item of updatedTiles) {
      const [tileId, teamId] = item.split(":");
      if (tileId && teamId) {
        await checkAndAutoCompleteTile(tileId, teamId);
      }
    }

    return { success: true, message: "Sync complete" }
  } catch (error) {
    logger.error({ error }, "Error syncing tracker progress:", error)
    return { success: false, error: "Failed to sync tracker progress" }
  }
}

export async function createWiseOldManCompetition(bingoId: string, metric: string, customStartsAt?: Date, customEndsAt?: Date) {
  try {
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: { event: true }
    });

    if (!bingo) return { success: false, error: "Bingo not found" };

    const eventTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, bingo.eventId),
      with: {
        teamMembers: {
          with: { user: true }
        }
      }
    });

    const teamsPayload: { name: string, participants: string[] }[] = [];
    for (const team of eventTeams) {
      const participants = team.teamMembers
        .map(member => member.user.runescapeName)
        .filter((name): name is string => name !== null && name !== undefined);
        
      if (participants.length > 0) {
        teamsPayload.push({
          name: team.trackerTeamName || team.name,
          participants
        });
      }
    }

    const womClient = new WOMClient({
      apiKey: process.env.WISEOLDMAN_API_KEY,
      userAgent: "Bingoscape/1.0.0",
    });

    const comp = await womClient.competitions.createCompetition({
      title: `${bingo.title} - ${metric}`,
      metric: metric as import("@wise-old-man/utils").Metric,
      startsAt: customStartsAt || bingo.event.startDate,
      endsAt: customEndsAt || bingo.event.endDate,
      teams: teamsPayload
    });

    await db.update(bingos)
      .set({
        womCompetitionId: comp.competition.id,
        womVerificationCode: comp.verificationCode
      })
      .where(eq(bingos.id, bingoId));

    return { success: true, womCompetitionId: comp.competition.id };
  } catch (error) {
    logger.error({ error }, "Error creating WOM competition:", error);
    return { success: false, error: "Failed to create WOM competition" };
  }
}

export async function linkWiseOldManCompetition(bingoId: string, competitionId: number, verificationCode?: string) {
  try {
    // Optionally verify that the competition exists
    const womResult = await fetchCompetitionFromWOM(competitionId);
    if (!womResult.success) {
      return { success: false, error: "Competition not found on WiseOldMan" };
    }

    await db.update(bingos)
      .set({
        womCompetitionId: competitionId,
        womVerificationCode: verificationCode || null
      })
      .where(eq(bingos.id, bingoId));

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error linking WOM competition:", error);
    return { success: false, error: "Failed to link WOM competition" };
  }
}

export async function unlinkWiseOldManCompetition(bingoId: string) {
  try {
    await db.update(bingos)
      .set({
        womCompetitionId: null,
        womVerificationCode: null
      })
      .where(eq(bingos.id, bingoId));
    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error unlinking WOM competition:", error);
    return { success: false, error: "Failed to unlink WOM competition" };
  }
}
