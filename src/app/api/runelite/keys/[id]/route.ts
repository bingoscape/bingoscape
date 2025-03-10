import { NextResponse } from "next/server"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { apiKeys } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"

// Delete an API key
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerAuthSession()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = params

  try {
    // Verify the key belongs to the user before deleting
    const [deletedKey] = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, session.user.id)))
      .returning({ id: apiKeys.id })

    if (!deletedKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting API key:", error)
    return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 })
  }
}

