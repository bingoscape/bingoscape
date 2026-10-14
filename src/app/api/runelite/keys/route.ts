import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { apiKeys } from "@/server/db/schema"
import { createApiKeyForUser } from "@/server/api-keys"
import { eq } from "drizzle-orm"
import { z } from "zod"

// Generate a new API key for the authenticated user
export async function POST(req: Request) {
  const session = await getServerAuthSession()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Parse request body
    const body = await req.json()

    // Validate request body
    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
    })

    const { name, description } = schema.parse(body)

    // Only the hash is stored; the plaintext is returned this once.
    const created = await createApiKeyForUser(session.user.id, {
      name,
      description: description ?? null,
    })
    const apiKey = {
      id: created.id,
      name: created.name,
      description: created.description,
      createdAt: created.createdAt,
      keyPrefix: created.keyPrefix,
      scopes: created.scopes,
      expiresAt: created.expiresAt,
      key: created.key,
    }

    return NextResponse.json(apiKey)
  } catch (error) {
    logger.error({ error }, "Error generating API key:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to generate API key" },
      { status: 500 }
    )
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
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, session.user.id))
      .orderBy(apiKeys.createdAt)

    return NextResponse.json(keys)
  } catch (error) {
    logger.error({ error }, "Error fetching API keys:", error)
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    )
  }
}
