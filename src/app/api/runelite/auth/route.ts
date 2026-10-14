import { logger } from "@/lib/logger"
import { checkApiKey } from "@/lib/api-auth"
import { limitRequest } from "@/server/rate-limit"
import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

// Verify an API key and return user information
export async function POST(req: Request) {
  // Unauthenticated by nature, so limited per client IP (stops key guessing).
  const limited = await limitRequest("runeliteAuth", req)
  if (limited) return limited

  try {
    // Parse request body
    const body = await req.json()

    // Validate request body
    const schema = z.object({
      apiKey: z.string().min(1),
    })

    const { apiKey } = schema.parse(body)

    // Hash lookup (then the legacy plaintext column); revoked and expired
    // keys are refused like unknown ones.
    const check = await checkApiKey(apiKey, { scope: "read" })
    if (!check.ok) {
      return NextResponse.json({ valid: false }, { status: 401 })
    }
    const key = check.key

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
      return NextResponse.json(
        { valid: false, error: "Invalid request data" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { valid: false, error: "Failed to verify API key" },
      { status: 500 }
    )
  }
}
