import { db } from "@/server/db"
import { apiKeys } from "@/server/db/schema"
import { and, eq, isNull, lt, or } from "drizzle-orm"

/** `apiKeys.lastUsed` is written at most this often per key. */
export const LAST_USED_THROTTLE_MS = 60_000

/**
 * Validates an API key from the request headers and returns the associated user ID if valid
 * @param req The incoming request
 * @returns The user ID if the API key is valid, null otherwise
 */
export async function validateApiKey(req: Request): Promise<string | null> {
  try {
    // Get the Authorization header
    const authHeader = req.headers.get("Authorization")

    if (!authHeader) {
      return null
    }
    // Extract the API key (Bearer token format)
    const match = authHeader.match(/^Bearer\s+(.+)$/)
    if (!match) {
      return null
    }

    const apiKey = match[1]!

    // Look up the API key in the database
    const [key] = await db
      .select({
        userId: apiKeys.userId,
        lastUsed: apiKeys.lastUsed,
      })
      .from(apiKeys)
      .where(eq(apiKeys.key, apiKey))
      .limit(1)

    if (!key) {
      return null
    }

    // Update the last used timestamp, at most once per throttle window. The
    // read above skips the write for most calls; the guard in the WHERE keeps
    // concurrent instances from all writing in the same window.
    const now = new Date()
    const cutoff = new Date(now.getTime() - LAST_USED_THROTTLE_MS)
    if (!key.lastUsed || key.lastUsed < cutoff) {
      await db
        .update(apiKeys)
        .set({ lastUsed: now })
        .where(
          and(
            eq(apiKeys.key, apiKey),
            or(isNull(apiKeys.lastUsed), lt(apiKeys.lastUsed, cutoff))
          )
        )
    }

    return key.userId
  } catch (error) {
    console.error("Error validating API key:", error)
    return null
  }
}
