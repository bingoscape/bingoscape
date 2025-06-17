interface DiscordEmbed {
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

export async function sendDiscordWebhook(webhookUrl: string, payload: DiscordWebhookPayload): Promise<boolean> {
  try {
    const formData = new FormData()

    // Add files as attachments if they exist
    if (payload.files && payload.files.length > 0) {
      payload.files.forEach((file, index) => {
        const blob = new Blob([file.attachment])
        formData.append(`files[${index}]`, blob, file.name)
      })

      // Update embed to reference the attachment
      // eslint-disable-next-line
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
      }),
    )

    const response = await fetch(webhookUrl, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      console.error("Discord webhook failed:", response.status, await response.text())
      return false
    }

    return true
  } catch (error) {
    console.error("Discord webhook error:", error)
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

  debugger;
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

  // Convert HSL color to hex
  const colorRegex = /hsl$$(\d+),\s*(\d+)%,\s*(\d+)%$$/
  const colorMatch = colorRegex.exec(teamColor)
  let hexColor = 0x7289da // Default Discord blue

  if (colorMatch) {
    const [, h, s, l] = colorMatch.map(Number)

    // Simple HSL to RGB conversion for Discord color
    const c = (1 - Math.abs(2 * (l! / 100) - 1)) * (s! / 100)
    const x = c * (1 - Math.abs(((h! / 60) % 2) - 1))
    const m = l! / 100 - c / 2

    let r = 0,
      g = 0,
      b = 0
    if (h! >= 0 && h! < 60) {
      r = c
      g = x
      b = 0
    } else if (h! >= 60 && h! < 120) {
      r = x
      g = c
      b = 0
    } else if (h! >= 120 && h! < 180) {
      r = 0
      g = c
      b = x
    } else if (h! >= 180 && h! < 240) {
      r = 0
      g = x
      b = c
    } else if (h! >= 240 && h! < 300) {
      r = x
      g = 0
      b = c
    } else if (h! >= 300 && h! < 360) {
      r = c
      g = 0
      b = x
    }

    r = Math.round((r + m) * 255)
    g = Math.round((g + m) * 255)
    b = Math.round((b + m) * 255)

    hexColor = (r << 16) | (g << 8) | b
  }

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
