import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { clanMembers, clanInvites } from "@/server/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { getServerAuthSession } from "@/server/auth"

export interface JoinClanResponse {
    success: boolean
    clanName?: string
    isMainClan?: boolean
    error?: string
}

export async function POST(req: Request) {
    const session = await getServerAuthSession()

    if (!session || !session.user) {
        return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

     
    const { inviteCode } = await req.json()

    if (!inviteCode) {
        return NextResponse.json({ success: false, error: "Invite code is required" }, { status: 400 })
    }

    // Find the invite
    const invite = await db.query.clanInvites.findFirst({
        where: eq(clanInvites.inviteCode, inviteCode as string),
        with: {
            clan: true,
        },
    })

    if (!invite) {
        return NextResponse.json({ success: false, error: "Invalid invite code" }, { status: 400 })
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
        return NextResponse.json({ success: false, error: "Invite has expired" }, { status: 400 })
    }

    // Check if invite is active
    if (!invite.isActive) {
        return NextResponse.json({ success: false, error: "This invite has been revoked" }, { status: 400 })
    }

    // Check usage limits
    if (invite.maxUses !== null && invite.currentUses >= invite.maxUses) {
        return NextResponse.json({ success: false, error: "Invite usage limit reached" }, { status: 400 })
    }

    // Check if user is already a member of any clan
    const userClans = await db.query.clanMembers.findMany({
        where: eq(clanMembers.userId, session.user.id),
    })

    const isFirstClan = userClans.length === 0

    // Check if user is already a member of this specific clan
    const existingMembership = userClans.find((clan) => clan.clanId === invite.clanId)

    if (existingMembership) {
        return NextResponse.json({ success: false, error: "Already a member of this clan" }, { status: 400 })
    }

    // Use transaction for atomic operations
    await db.transaction(async (tx) => {
        // Add user to clan
        await tx.insert(clanMembers).values({
            clanId: invite.clanId,
            userId: session.user.id,
            role: "member",
            isMain: isFirstClan,
        })

        // If this is the first clan, ensure it's set as the main clan
        if (isFirstClan) {
            await tx
                .update(clanMembers)
                .set({ isMain: true })
                .where(and(eq(clanMembers.userId, session.user.id), eq(clanMembers.clanId, invite.clanId)))
        }

        // Increment usage counter atomically
        await tx.update(clanInvites)
            .set({
                currentUses: sql`${clanInvites.currentUses} + 1`,
                updatedAt: new Date()
            })
            .where(eq(clanInvites.id, invite.id))
    })

    return NextResponse.json({
        success: true,
        clanName: invite.clan.name,
        isMainClan: isFirstClan,
    })
}

