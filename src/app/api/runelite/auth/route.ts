/* eslint-disable */
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { apiKeys, users } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

// Verify an API key and return user information
export async function POST(req: Request) {
  try {
    // Parse request body
    const body = await req.json()

    // Validate request body
    const schema = z.object({
      apiKey: z.string().min(1),
    })

    const { apiKey } = schema.parse(body)

    // Look up the API key in the database
    const [key] = await db
      .select({
        userId: apiKeys.userId,
        name: apiKeys.name,
      })
      .from(apiKeys)
      .where(eq(apiKeys.key, apiKey))
      .limit(1)

    if (!key) {
      return NextResponse.json({ valid: false }, { status: 401 })
    }

    // Update the last used timestamp
    await db.update(apiKeys).set({ lastUsed: new Date() }).where(eq(apiKeys.key, apiKey))

    // Get user information
    const user = await db.query.users.findFirst({
      where: eq(users.id, key.userId),
      columns: {
        id: true,
        name: true,
        runescapeName: true,
        image: true,
      },
    })

    if (!user) {
      return NextResponse.json({ valid: false }, { status: 401 })
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        name: user.name,
        runescapeName: user.runescapeName,
        image: user.image,
      },
    })
  } catch (error) {
    logger.error({ error }, "Error verifying API key:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ valid: false, error: "Invalid request data" }, { status: 400 })
    }

    return NextResponse.json({ valid: false, error: "Failed to verify API key" }, { status: 500 })
  }
}

