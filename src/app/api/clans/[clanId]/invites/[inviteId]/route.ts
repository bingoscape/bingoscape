import { NextResponse } from 'next/server'
import { updateClanInviteLabel, deleteClanInvite, revokeClanInvite } from '@/app/actions/clan'

// PATCH - Update invite label
export async function PATCH(
    req: Request,
    props: { params: Promise<{ clanId: string, inviteId: string }> }
) {
    const params = await props.params;
    try {
        const { label } = await req.json() as { label: string }
        await updateClanInviteLabel(params.inviteId, label)
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update invite" },
            { status: 500 }
        )
    }
}

// DELETE - Delete invite permanently
export async function DELETE(
    _: Request,
    props: { params: Promise<{ clanId: string, inviteId: string }> }
) {
    const params = await props.params;
    try {
        await deleteClanInvite(params.inviteId)
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete invite" },
            { status: 500 }
        )
    }
}

// POST - Revoke invite (soft delete)
export async function POST(
    req: Request,
    props: { params: Promise<{ clanId: string, inviteId: string }> }
) {
    const params = await props.params;
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    if (action === 'revoke') {
        try {
            await revokeClanInvite(params.inviteId)
            return NextResponse.json({ success: true })
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : "Failed to revoke invite" },
                { status: 500 }
            )
        }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
