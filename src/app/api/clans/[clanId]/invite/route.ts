import { NextResponse } from 'next/server'
import { db } from "@/server/db"
import { clanMembers, clanInvites } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { nanoid } from 'nanoid'
import { getServerAuthSession } from '@/server/auth'

export interface GenerateInviteResponse {
    inviteCode: string
}


export async function POST(_: Request, props: { params: Promise<{ clanId: string }> }) {
    const params = await props.params;
    const session = await getServerAuthSession()

    if (!session || !session.user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { clanId } = params


    // Check if the user is the clan owner or an admin
    const userMembership = await db.query.clanMembers.findFirst({
        where: and(
            eq(clanMembers.clanId, clanId),
            eq(clanMembers.userId, session.user.id)
        ),
    })

    if (!userMembership || (userMembership.role != 'admin' && userMembership.role != 'management')) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Generate a unique invite code
    const inviteCode = nanoid(10)

    // Set expiration to 7 days from now
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Create the invite
    const [invite] = await db.insert(clanInvites).values({
        clanId,
        inviteCode,
        expiresAt,
    }).returning()

    return NextResponse.json({ inviteCode: invite!.inviteCode })
}
