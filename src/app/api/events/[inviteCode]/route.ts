import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { eventInvites } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { getServerAuthSession } from "@/server/auth"

export async function GET(request: NextRequest, { params }: { params: { inviteCode: string } }) {
  try {
    const session = await getServerAuthSession()
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { inviteCode } = params

    const invite = await db.query.eventInvites.findFirst({
      where: eq(eventInvites.inviteCode, inviteCode),
      with: {
        event: true,
      },
    })

    if (!invite || (invite.expiresAt && invite.expiresAt < new Date())) {
      return NextResponse.json({ error: "Invalid or expired invite code" }, { status: 404 })
    }

    return NextResponse.json(invite.event)
  } catch (error) {
    console.error("Error fetching event from invite:", error)
    return NextResponse.json({ error: "Failed to fetch event details" }, { status: 500 })
  }
}

