import { NextResponse } from "next/server"
import { logger } from "@/lib/logger";
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { apiKeys } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

// Generate a new API key for the authenticated user
export async function POST(req: Request) {
  const session = await getServerAuthSession()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Parse request body|
     
    const body = await req.json()

    // Validate request body
    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
    })

    const { name, description } = schema.parse(body)

    // Generate a unique API key
    const key = `bsn_${nanoid(32)}`

    // Insert the new API key into the database
    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        userId: session.user.id,
        name,
        description: description ?? null,
        key,
        lastUsed: null,
      })
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        description: apiKeys.description,
        createdAt: apiKeys.createdAt,
        // Only return the key in the response when it's first created
        key: apiKeys.key,
      })

    return NextResponse.json(apiKey)
  } catch (error) {
    logger.error({ error }, "Error generating API key:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to generate API key" }, { status: 500 })
  }
}

// Get all API keys for the authenticated user
export async function GET() {
  const session = await getServerAuthSession()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        description: apiKeys.description,
        createdAt: apiKeys.createdAt,
        lastUsed: apiKeys.lastUsed,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, session.user.id))
      .orderBy(apiKeys.createdAt)

    return NextResponse.json(keys)
  } catch (error) {
    logger.error({ error }, "Error fetching API keys:", error)
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 })
  }
}

