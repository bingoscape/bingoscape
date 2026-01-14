import { NextResponse } from 'next/server'
import { getClanInvites } from '@/app/actions/clan'

export async function GET(_: Request, props: { params: Promise<{ clanId: string }> }) {
    const params = await props.params;
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
