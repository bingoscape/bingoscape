import { logger } from "@/lib/logger"
import { isDiscordWebhookUrl } from "@/lib/discord-webhook-url"

export interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
  footer?: {
    text: string
  }
  timestamp?: string
  image?: {
    url: string
  }
}

interface DiscordWebhookPayload {
  embeds?: DiscordEmbed[]
  files?: Array<{
    attachment: Buffer
    name: string
  }>
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: DiscordWebhookPayload
): Promise<boolean> {
  // Stored URLs are user supplied: never POST anywhere but Discord.
  if (!isDiscordWebhookUrl(webhookUrl)) {
    logger.warn("Refusing to send to a non-Discord webhook URL")
    return false
  }

  try {
    const formData = new FormData()

    // Add files as attachments if they exist
    if (payload.files && payload.files.length > 0) {
      payload.files.forEach((file, index) => {
        const blob = new Blob([new Uint8Array(file.attachment)])
        formData.append(`files[${index}]`, blob, file.name)
      })

      // Update embed to reference the attachment

      if (payload.embeds && payload.embeds[0] && payload.files[0]) {
        payload.embeds[0].image = {
          url: `attachment://${payload.files[0].name}`,
        }
      }
    }

    // Add the payload as JSON
    formData.append(
      "payload_json",
      JSON.stringify({
        embeds: payload.embeds,
      })
    )

    const response = await fetch(webhookUrl, {
      method: "POST",
      body: formData,
      redirect: "error",
    })

    if (!response.ok) {
      const responseText = await response.text()
      logger.error(
        { status: response.status, response: responseText },
        "Discord webhook failed"
      )
      return false
    }

    return true
  } catch (error) {
    logger.error({ error }, "Discord webhook error")
    return false
  }
}

export async function testDiscordWebhook(webhookUrl: string): Promise<boolean> {
  const testEmbed: DiscordEmbed = {
    title: "🧪 Test Webhook",
    description: "This is a test message from BingoScape!",
    color: 0x00ff00, // Green color
    fields: [
      {
        name: "Status",
        value: "✅ Webhook is working correctly!",
        inline: false,
      },
    ],
    footer: {
      text: "BSN Discord Integration",
    },
    timestamp: new Date().toISOString(),
  }

  return sendDiscordWebhook(webhookUrl, { embeds: [testEmbed] })
}

interface SubmissionEmbedData {
  userName: string
  runescapeName?: string | null
  teamName: string
  tileName: string
  tileDescription?: string | null
  eventTitle: string
  bingoTitle: string
  submissionCount: number
  teamColor: string
  goalDescription?: string | null
  goalProgress?: number | null
  goalTarget?: number | null
}

/**
 * Converts an HSL string like "hsl(240, 70%, 50%)" to a Discord integer color.
 * Falls back to Discord blurple if parsing fails.
 */
function hslStringToHex(hslColor: string): number {
  const colorRegex = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/
  const colorMatch = colorRegex.exec(hslColor)
  if (!colorMatch) return 0x7289da

  const [, h, s, l] = colorMatch.map(Number)
  const c = (1 - Math.abs(2 * (l! / 100) - 1)) * (s! / 100)
  const x = c * (1 - Math.abs(((h! / 60) % 2) - 1))
  const m = l! / 100 - c / 2

  let r = 0,
    g = 0,
    b = 0
  if (h! >= 0 && h! < 60) {
    r = c; g = x; b = 0
  } else if (h! >= 60 && h! < 120) {
    r = x; g = c; b = 0
  } else if (h! >= 120 && h! < 180) {
    r = 0; g = c; b = x
  } else if (h! >= 180 && h! < 240) {
    r = 0; g = x; b = c
  } else if (h! >= 240 && h! < 300) {
    r = x; g = 0; b = c
  } else if (h! >= 300 && h! < 360) {
    r = c; g = 0; b = x
  }

  return (
    (Math.round((r + m) * 255) << 16) |
    (Math.round((g + m) * 255) << 8) |
    Math.round((b + m) * 255)
  )
}

/** Derive a deterministic team color string from a team name. */
export function getTeamHslColor(teamName: string): string {
  return `hsl(${(teamName.charCodeAt(0) * 10) % 360}, 70%, 50%)`
}

export function createSubmissionEmbed(data: SubmissionEmbedData): DiscordEmbed {
  const {
    userName,
    runescapeName,
    teamName,
    tileName,
    tileDescription,
    eventTitle,
    bingoTitle,
    submissionCount,
    teamColor,
    goalDescription,
    goalProgress,
    goalTarget,
  } = data

  const hexColor = hslStringToHex(teamColor)

  const fields = [
    {
      name: "👤 Player",
      value: runescapeName ?? userName,
      inline: true,
    },
    {
      name: "🏆 Team",
      value: teamName,
      inline: true,
    },
    {
      name: "📊 Submission #",
      value: submissionCount.toString(),
      inline: true,
    },
  ]

  // Add goal information if available
  if (goalDescription) {
    let goalValue = goalDescription
    if (goalProgress !== null && goalTarget !== null) {
      const percentage = Math.round((goalProgress! / goalTarget!) * 100)
      goalValue += `\n📈 Progress: ${goalProgress}/${goalTarget} (${percentage}%)`
    }

    fields.push({
      name: "🎯 Goal",
      value: goalValue,
      inline: false,
    })
  }

  return {
    title: `🎯 New Submission: ${tileName}`,
    description: tileDescription ?? "A new submission has been made!",
    color: hexColor,
    fields,
    footer: {
      text: `${eventTitle} • ${bingoTitle}`,
    },
    timestamp: new Date().toISOString(),
    // Image will be set to attachment URL when file is attached
  }
}

// ---------------------------------------------------------------------------
// WoM tracker notification embeds
// ---------------------------------------------------------------------------

export interface GoalCompleteEmbedData {
  teamName: string
  teamColor: string
  tileName: string
  goalDescription: string
  metricName: string
  currentValue: number
  targetValue: number
  eventTitle: string
  bingoTitle: string
}

/**
 * Embed sent when a single WoM metric goal crosses its targetValue for a team.
 */
export function createGoalCompleteEmbed(data: GoalCompleteEmbedData): DiscordEmbed {
  const {
    teamName,
    teamColor,
    tileName,
    goalDescription,
    metricName,
    currentValue,
    targetValue,
    eventTitle,
    bingoTitle,
  } = data

  const percentage = Math.min(100, Math.round((currentValue / targetValue) * 100))
  const formattedCurrent = currentValue.toLocaleString("en-US")
  const formattedTarget = targetValue.toLocaleString("en-US")

  return {
    title: "🎯 Goal Reached!",
    description: `**${teamName}** reached a tracker milestone!`,
    color: hslStringToHex(teamColor),
    fields: [
      { name: "🧩 Tile", value: tileName, inline: true },
      { name: "🏆 Team", value: teamName, inline: true },
      { name: "\u200B", value: "\u200B", inline: true },
      { name: "🎯 Goal", value: goalDescription, inline: false },
      {
        name: "📊 Metric",
        value: metricName
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        inline: true,
      },
      {
        name: "📈 Progress",
        value: `${formattedCurrent} / ${formattedTarget} (${percentage}%)`,
        inline: true,
      },
    ],
    footer: { text: `${eventTitle} • ${bingoTitle}` },
    timestamp: new Date().toISOString(),
  }
}

export interface TileCompleteEmbedData {
  teamName: string
  tileName: string
  tileDescription?: string | null
  eventTitle: string
  bingoTitle: string
}

/**
 * Embed sent when an entire tile auto-completes via the WoM tracker sync.
 */
export function createTileCompleteEmbed(data: TileCompleteEmbedData): DiscordEmbed {
  const { teamName, tileName, tileDescription, eventTitle, bingoTitle } = data

  return {
    title: "🏆 Tile Completed!",
    description: `**${teamName}** has auto-completed a bingo tile via the WoM tracker!`,
    color: 0xffd700, // Gold
    fields: [
      { name: "🧩 Tile", value: tileName, inline: true },
      { name: "🏆 Team", value: teamName, inline: true },
      ...(tileDescription
        ? [{ name: "📝 Details", value: tileDescription, inline: false }]
        : []),
      {
        name: "⚙️ Completed via",
        value: "WiseOldMan Tracker Sync",
        inline: false,
      },
    ],
    footer: { text: `${eventTitle} • ${bingoTitle}` },
    timestamp: new Date().toISOString(),
  }
}


// ---------------------------------------------------------------------------
// Team draft embeds (epic #214, phase 4/4 #218)
// ---------------------------------------------------------------------------

/** Discord limits: 25 fields, 1024 characters per field value. */
const EMBED_FIELD_LIMIT = 25
const EMBED_VALUE_LIMIT = 1024

/** Keeps a name from being read as Discord markdown. */
function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_~`|>])/g, "\\$1")
}

function clip(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`
}

export interface DraftRosterEmbedTeam {
  teamName: string
  captainName: string
  /** The drafted players in pick order. */
  players: string[]
}

export interface DraftStartedEmbedData {
  eventTitle: string
  /** Teams in the order of the first round. */
  teams: { teamName: string; captainName: string }[]
  poolSize: number
  rounds: number
  /** "Snake", "Linear" or "Random snake". */
  orderLabel: string
  /** Seconds per pick; null: no timer. */
  pickTimerSeconds: number | null
}

/** Embed sent when the draft starts: the teams in pick order and the pool. */
export function createDraftStartedEmbed(
  data: DraftStartedEmbedData
): DiscordEmbed {
  const order = data.teams
    .map(
      (team, i) =>
        `${i + 1}. **${escapeMarkdown(team.teamName)}** (captain ${escapeMarkdown(team.captainName)})`
    )
    .join("\n")
  return {
    title: "🏁 Team draft started",
    description: clip(order, 4000),
    color: 0x5865f2,
    fields: [
      { name: "👥 Pool", value: `${data.poolSize} players`, inline: true },
      { name: "🔁 Rounds", value: String(data.rounds), inline: true },
      { name: "↕️ Order", value: data.orderLabel, inline: true },
      {
        name: "⏱️ Pick timer",
        value:
          data.pickTimerSeconds === null
            ? "No timer"
            : `${data.pickTimerSeconds} seconds`,
        inline: true,
      },
    ],
    footer: { text: data.eventTitle },
    timestamp: new Date().toISOString(),
  }
}

export interface DraftPickEmbedData {
  eventTitle: string
  pickNo: number
  totalPicks: number
  round: number
  teamName: string
  /** `hsl(...)` string, see `getTeamHslColor`. */
  teamColor: string
  playerName: string
  /** Rating out of 100; null: unrated. */
  rating: number | null
  /** "forced" (a manager picked), "timer" (auto-pick), or null (the captain). */
  madeBy: "forced" | "timer" | null
}

/** Embed sent for each pick. */
export function createDraftPickEmbed(data: DraftPickEmbedData): DiscordEmbed {
  const how =
    data.madeBy === "timer"
      ? "Auto-picked when the timer ran out"
      : data.madeBy === "forced"
        ? "Picked by an organizer"
        : "Picked by the captain"
  return {
    title: `🎯 Pick #${data.pickNo}: ${escapeMarkdown(data.playerName)}`,
    description: `**${escapeMarkdown(data.teamName)}** drafted **${escapeMarkdown(data.playerName)}**`,
    color: hslStringToHex(data.teamColor),
    fields: [
      { name: "🏆 Team", value: escapeMarkdown(data.teamName), inline: true },
      { name: "🔁 Round", value: String(data.round), inline: true },
      {
        name: "⭐ Rating",
        value: data.rating === null ? "Unrated" : `${data.rating}/100`,
        inline: true,
      },
      { name: "🧾 How", value: how, inline: false },
    ],
    footer: {
      text: `${data.eventTitle} • pick ${data.pickNo} of ${data.totalPicks}`,
    },
    timestamp: new Date().toISOString(),
  }
}

export interface DraftUndoEmbedData {
  eventTitle: string
  pickNo: number
  teamName: string
  playerName: string
}

/** Embed sent when an organizer takes the last pick back. */
export function createDraftUndoEmbed(data: DraftUndoEmbedData): DiscordEmbed {
  return {
    title: `↩️ Pick #${data.pickNo} undone`,
    description: `**${escapeMarkdown(data.playerName)}** is back in the pool and **${escapeMarkdown(data.teamName)}** is on the clock again.`,
    color: 0xed4245,
    footer: { text: data.eventTitle },
    timestamp: new Date().toISOString(),
  }
}

function rosterFields(teams: DraftRosterEmbedTeam[]) {
  return teams.slice(0, EMBED_FIELD_LIMIT).map((team) => ({
    name: `🏆 ${clip(escapeMarkdown(team.teamName), 200)}`,
    value: clip(
      [
        `👑 ${escapeMarkdown(team.captainName)}`,
        ...team.players.map((name) => `• ${escapeMarkdown(name)}`),
      ].join("\n"),
      EMBED_VALUE_LIMIT
    ),
    inline: true,
  }))
}

export interface DraftRostersEmbedData {
  eventTitle: string
  teams: DraftRosterEmbedTeam[]
}

/** Embed sent when the last pick is made: the final rosters. */
export function createDraftCompleteEmbed(
  data: DraftRostersEmbedData
): DiscordEmbed {
  return {
    title: "✅ Team draft complete",
    description: "Every pick is in. An organizer still has to apply the teams.",
    color: 0x57f287,
    fields: rosterFields(data.teams),
    footer: { text: data.eventTitle },
    timestamp: new Date().toISOString(),
  }
}

/** Embed sent when an organizer applies the draft: the teams are final. */
export function createDraftAppliedEmbed(
  data: DraftRostersEmbedData
): DiscordEmbed {
  return {
    title: "📣 Teams are set",
    description: "The drafted players have joined their teams.",
    color: 0xffd700,
    fields: rosterFields(data.teams),
    footer: { text: data.eventTitle },
    timestamp: new Date().toISOString(),
  }
}
