import { NextResponse } from 'next/server'
import { getServerAuthSession } from '@/server/auth'
import { createClanInvite } from '@/app/actions/clan'

export interface GenerateInviteRequest {
    label?: string
    expiresInDays?: number | null // null = permanent, 0 = same as null
    maxUses?: number | null // null = unlimited
}

export interface GenerateInviteResponse {
    inviteCode: string
    id: string
    expiresAt: Date | null
    maxUses: number | null
    label: string | null
}


export async function POST(req: Request, props: { params: Promise<{ clanId: string }> }) {
    const params = await props.params;
    const session = await getServerAuthSession()

    if (!session || !session.user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { clanId } = params

    // Parse request body
    let body: GenerateInviteRequest = {}
    try {
        body = await req.json() as GenerateInviteRequest
    } catch {
        // If no body provided, use defaults (7 days expiration for backward compatibility)
        body = { expiresInDays: 7 }
    }

    try {
        const invite = await createClanInvite({
            clanId,
            label: body.label,
            expiresInDays: body.expiresInDays === 0 ? null : body.expiresInDays ?? 7, // Default to 7 days for backward compatibility
            maxUses: body.maxUses,
        })

        if (!invite) {
            throw new Error("Failed to create invite")
        }

        return NextResponse.json({
            inviteCode: invite.inviteCode,
            id: invite.id,
            expiresAt: invite.expiresAt,
            maxUses: invite.maxUses,
            label: invite.label,
        })
    } catch (error) {
        if (error instanceof Error) {
            return NextResponse.json(
                { error: error.message },
                { status: error.message.includes("authorized") ? 403 : 400 }
            )
        }
        return NextResponse.json(
            { error: "Failed to generate invite" },
            { status: 500 }
        )
    }
}
