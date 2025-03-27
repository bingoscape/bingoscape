import { db } from "@/server/db"
import { eventInvites } from "@/server/db/schema"
import { eq } from "drizzle-orm"

// Improve error handling in the invite code API
export async function GET(request: Request, { params }: { params: { inviteCode: string } }) {
  try {
    const { inviteCode } = params

    const invite = await db.query.eventInvites.findFirst({
      where: eq(eventInvites.inviteCode, inviteCode),
      with: {
        event: true,
      },
    })

    if (!invite) {
      return Response.json({ error: "Invalid invite code" }, { status: 404 })
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return Response.json({ error: "This invite link has expired" }, { status: 410 })
    }

    // Return basic event info without joining
    return Response.json({
      id: invite.event.id,
      title: invite.event.title,
      description: invite.event.description,
      startDate: invite.event.startDate,
      endDate: invite.event.endDate,
      requiresApproval: invite.event.requiresApproval,
    })
  } catch (error) {
    console.error("Error fetching invite:", error)
    return Response.json({ error: "An error occurred while processing your request" }, { status: 500 })
  }
}

