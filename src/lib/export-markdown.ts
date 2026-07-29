import type { EventStatsData } from "@/app/actions/stats"
import type { ItemStatistics } from "@/app/actions/item-statistics"
import { formatGPValue } from "@/lib/format-gp"

export function generateEventMarkdown(
  eventStats: EventStatsData,
  itemStats: ItemStatistics | undefined,
  eventTitle: string
): string {
  // Overall Progress
  const totalEventXP = eventStats.totalEventXP.toLocaleString()
  const totalPossibleEventXP = eventStats.totalPossibleEventXP.toLocaleString()
  const completionRate =
    eventStats.totalPossibleEventXP > 0 && eventStats.eventTeamPoints.length > 0
      ? (
          (eventStats.totalEventXP /
            (eventStats.totalPossibleEventXP *
              eventStats.eventTeamPoints.length)) *
          100
        ).toFixed(1)
      : "0.0"

  let md = `# Statistics: ${eventTitle}\n*Current standings and milestones!*\n\n`

  md += `## Overall Event Progress\n`
  md += `- **Total Points:** ${totalEventXP} / ${totalPossibleEventXP} (${completionRate}%)\n`
  
  if (itemStats) {
    md += `- **Total Loot Value:** ${formatGPValue(itemStats.totalValue)} GP\n`
    if (itemStats.profitPerHour) {
      md += `- **Event Profit/Hr:** ${formatGPValue(itemStats.profitPerHour)} GP/hr\n`
    }
    md += `- **Unique Items Found:** ${itemStats.uniqueItemsCount.toLocaleString()}\n`
    md += `- **Submissions:** ${itemStats.totalSubmissions.toLocaleString()} total\n`
  }
  md += `\n`

  if (eventStats.bingoSummary.length > 0) {
    md += `## Board Progress\n`
    eventStats.bingoSummary.forEach((board) => {
      md += `- **${board.title}**: ${board.completionRate}% completion\n`
    })
    md += `\n`
  }

  md += `## Team Leaderboard\n\n`

  eventStats.eventTeamPoints.forEach((team, index) => {
    // Get item stats for this team
    const teamItemStats = itemStats?.teamStats.find((ts) => ts.teamName === team.name)
    const lootValue = teamItemStats ? formatGPValue(teamItemStats.totalValue) : "0"
    const submissions = teamItemStats ? teamItemStats.submissionCount.toLocaleString() : "0"

    const bonusXP = team.bonusXP && team.bonusXP > 0 ? ` (+${team.bonusXP.toLocaleString()} bonus)` : ""
    
    md += `**${index + 1}. ${team.name}**\n`
    md += `- **Points:** ${team.totalXP.toLocaleString()} XP${bonusXP}\n`
    if (itemStats) {
      md += `- **Loot Value:** ${lootValue} GP\n`
      md += `- **Submissions:** ${submissions}\n`
    }
    md += `\n`
  })

  if (itemStats) {
    md += `## Player Highlights\n`
    
    if (itemStats.mvp) {
      const mvpName = itemStats.mvp.runescapeName ?? itemStats.mvp.userName
      md += `**Event MVP (Highest Loot Value)**\n`
      md += `- **${mvpName}** (${itemStats.mvp.teamName}): ${formatGPValue(itemStats.mvp.totalValue)} GP from ${itemStats.mvp.submissionCount} drops!\n\n`
    }

    if (itemStats.mostValuableItem) {
      const mvi = itemStats.mostValuableItem
      const obtainer = mvi.obtainedBy[0]
      const obtainerName = obtainer ? (obtainer.runescapeName ?? obtainer.userName) : "Unknown"
      md += `**Most Valuable Drop**\n`
      md += `- **${mvi.itemName}** worth ${formatGPValue(mvi.totalValue)} GP (Secured by **${obtainerName}**)\n\n`
    }

    if (itemStats.topUsers && itemStats.topUsers.length > 0) {
      const topSubmitter = [...itemStats.topUsers].sort((a, b) => b.submissionCount - a.submissionCount)[0]
      if (topSubmitter) {
        const topSubmitterName = topSubmitter.runescapeName ?? topSubmitter.userName
        md += `**Most Dedicated (Most Submissions)**\n`
        md += `- **${topSubmitterName}**: ${topSubmitter.submissionCount.toLocaleString()} items submitted\n\n`
      }
    }

    if (itemStats.userStreaks && itemStats.userStreaks.length > 0) {
      const longestStreakUser = [...itemStats.userStreaks].sort((a, b) => b.longestStreak - a.longestStreak)[0]
      if (longestStreakUser && longestStreakUser.longestStreak > 1) {
        const streakName = longestStreakUser.runescapeName ?? longestStreakUser.userName
        md += `**Longest Grind Streak**\n`
        md += `- **${streakName}** (${longestStreakUser.teamName}): ${longestStreakUser.longestStreak} days in a row\n\n`
      }
    }

    if (itemStats.topUsers && itemStats.topUsers.length > 0) {
      md += `**Top Earners (GP)**\n`
      itemStats.topUsers.slice(0, 3).forEach((user, index) => {
        const userName = user.runescapeName ?? user.userName
        md += `${index + 1}. **${userName}** - ${formatGPValue(user.totalValue)} GP\n`
      })
      md += `\n`
    }
  }

  return md.trim()
}
