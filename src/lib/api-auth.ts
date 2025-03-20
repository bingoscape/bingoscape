/* eslint-disable */
import { db } from "@/server/db"
import { apiKeys } from "@/server/db/schema"
import { eq } from "drizzle-orm"

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
    console.log("authHeader", authHeader)

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
      })
      .from(apiKeys)
      .where(eq(apiKeys.key, apiKey))
      .limit(1)


    if (!key) {
      return null
    }

    // Update the last used timestamp
    await db.update(apiKeys).set({ lastUsed: new Date() }).where(eq(apiKeys.key, apiKey))

    return key.userId
  } catch (error) {
    console.error("Error validating API key:", error)
    return null
  }
}

