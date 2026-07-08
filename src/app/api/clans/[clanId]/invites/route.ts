import { NextResponse } from 'next/server'
import { getClanInvites } from '@/app/actions/clan/get-clan-invites'

export async function GET(_: Request, props: { params: Promise<{ clanId: string }> }) {
    const params = await props.params;
    try {
        const result = await getClanInvites({ clanId: params.clanId })
        
        if (result?.serverError) {
            return NextResponse.json({ error: result.serverError }, { status: 500 })
        }
        
        if (!result?.data?.success) {
            return NextResponse.json({ error: result?.data?.error ?? "Failed to fetch invites" }, { status: 403 })
        }
        
        return NextResponse.json(result.data.invites)
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch invites" },
            { status: 500 }
        )
    }
}
