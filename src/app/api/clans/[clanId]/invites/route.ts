import { NextResponse } from 'next/server'
import { getClanInvites } from '@/app/actions/clan'

export async function GET(
    _: Request,
    { params }: { params: { clanId: string } }
) {
    try {
        const invites = await getClanInvites(params.clanId)
        return NextResponse.json(invites)
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch invites" },
            { status: error instanceof Error && error.message.includes("authorized") ? 403 : 500 }
        )
    }
}
