/**
 * Accepts either a bare invite code or a full invite link
 * (`https://host/events/join/<code>`) and returns the code, or null if empty.
 */
export function parseInviteCode(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const match = /\/events\/join\/([^/?#\s]+)/.exec(trimmed)
  const code = match?.[1] ?? trimmed
  // A code is a single path segment; reject anything that isn't.
  if (/[\s/?#]/.test(code)) return null

  return code
}
