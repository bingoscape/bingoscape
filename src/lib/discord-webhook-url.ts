const DISCORD_WEBHOOK_HOSTS = new Set([
  "discord.com",
  "discordapp.com",
  "ptb.discord.com",
  "canary.discord.com",
])

/**
 * Whether the string is a Discord webhook URL: https, a Discord host (parsed,
 * not substring matched), the `/api/webhooks/` path, no credentials or port.
 * The server later POSTs to this URL, so anything else must be rejected.
 */
export function isDiscordWebhookUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  return (
    url.protocol === "https:" &&
    DISCORD_WEBHOOK_HOSTS.has(url.hostname) &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    url.pathname.startsWith("/api/webhooks/")
  )
}
