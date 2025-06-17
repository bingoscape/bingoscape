interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
  image?: {
    url: string
  }
  thumbnail?: {
    url: string
  }
  footer?: {
    text: string
  }
  timestamp?: string
}

interface DiscordWebhookPayload {
  content?: string
  embeds?: DiscordEmbed[]
}

export async function sendDiscordWebhook(webhookUrl: string, payload: DiscordWebhookPayload) {
  try {
    console.log("Sending Discord webhook to:", webhookUrl)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`)
    }

    return { success: true }
  } catch (error) {
    console.error('Discord webhook error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export function createSubmissionEmbed(data: {
  submissionImageUrl: string
  userName: string
  runescapeName?: string | null
  teamName: string
  tileName: string
  tileDescription: string
  goalDescription?: string | null
  goalProgress?: { current: number; target: number } | null
  eventTitle: string
  bingoTitle: string
  submissionCount: number
  teamColor: string
}): DiscordEmbed {
  const {
    submissionImageUrl,
    userName,
    runescapeName,
    teamName,
    tileName,
    tileDescription,
    goalDescription,
    goalProgress,
    eventTitle,
    bingoTitle,
    submissionCount,
    teamColor
  } = data

  const displayName = runescapeName || userName || 'Unknown Player'

  // Convert team color to Discord color (hex to decimal)
  const colorMatch = teamColor.match(/hsl\((\d+),/)
  const hue = colorMatch ? parseInt(colorMatch[1]!) : 0
  const discordColor = Math.floor((hue / 360) * 16777215) // Convert HSL hue to approximate hex color

  const embed: DiscordEmbed = {
    title: `🎯 New Submission: ${tileName}`,
    description: tileDescription,
    color: discordColor,
    image: {
      url: submissionImageUrl
    },
    fields: [
      {
        name: '👤 Submitted by',
        value: displayName,
        inline: true
      },
      {
        name: '🏆 Team',
        value: teamName,
        inline: true
      },
      {
        name: '📊 Submission #',
        value: submissionCount.toString(),
        inline: true
      }
    ],
    footer: {
      text: `${eventTitle} • ${bingoTitle}`
    },
    timestamp: new Date().toISOString()
  }

  // Add goal information if available
  if (goalDescription) {
    embed.fields?.push({
      name: '🎯 Goal',
      value: goalDescription,
      inline: false
    })

    if (goalProgress) {
      const progressPercentage = Math.round((goalProgress.current / goalProgress.target) * 100)
      const progressBar = createProgressBar(progressPercentage)

      embed.fields?.push({
        name: '📈 Goal Progress',
        value: `${progressBar} ${goalProgress.current}/${goalProgress.target} (${progressPercentage}%)`,
        inline: false
      })
    }
  }

  return embed
}

function createProgressBar(percentage: number, length: number = 10): string {
  const filled = Math.round((percentage / 100) * length)
  const empty = length - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

export async function testDiscordWebhook(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
  const testPayload: DiscordWebhookPayload = {
    embeds: [{
      title: '🧪 Test Webhook',
      description: 'This is a test message from BingoScape! Your Discord webhook is working correctly.',
      color: 0x00ff00, // Green color
      footer: {
        text: 'BingoScape Discord Integration'
      },
      timestamp: new Date().toISOString()
    }]
  }

  return sendDiscordWebhook(webhookUrl, testPayload)
}
