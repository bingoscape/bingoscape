import { NextResponse } from 'next/server'
import { db } from "@/server/db"
import { clanMembers, clanInvites } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { getServerAuthSession } from '@/server/auth'

export async function POST(req: Request) {
	const session = await getServerAuthSession()

	if (!session || !session.user) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
	}

	const { inviteCode } = await req.json()

	if (!inviteCode) {
		return NextResponse.json({ error: "Invite code is required" }, { status: 400 })
	}

	// Find the invite
	const invite = await db.query.clanInvites.findFirst({
		where: eq(clanInvites.inviteCode, inviteCode),
		with: {
			clan: true,
		},
	})

	if (!invite) {
		return NextResponse.json({ error: "Invalid invite code" }, { status: 400 })
	}

	if (invite.expiresAt && invite.expiresAt < new Date()) {
		return NextResponse.json({ error: "Invite has expired" }, { status: 400 })
	}

	// Check if user is already a member of any clan
	const userClans = await db.query.clanMembers.findMany({
		where: eq(clanMembers.userId, session.user.id),
	})

	const isFirstClan = userClans.length === 0

	// Check if user is already a member of this specific clan
	const existingMembership = userClans.find(clan => clan.clanId === invite.clanId)

	if (existingMembership) {
		return NextResponse.json({ error: "Already a member of this clan" }, { status: 400 })
	}

	// Add user to clan
	await db.insert(clanMembers).values({
		clanId: invite.clanId,
		userId: session.user.id,
		role: 'member',
		isMain: isFirstClan, // Set as main clan if it's the first clan
	})

	// If this is the first clan, ensure it's set as the main clan
	if (isFirstClan) {
		await db.update(clanMembers)
			.set({ isMain: true })
			.where(
				and(
					eq(clanMembers.userId, session.user.id),
					eq(clanMembers.clanId, invite.clanId)
				)
			)
	}

	// Optionally, you can delete the invite after it's used
	// await db.delete(clanInvites).where(eq(clanInvites.id, invite.id))

	return NextResponse.json({
		success: true,
		clanName: invite.clan.name,
		isMainClan: isFirstClan
	})
}
