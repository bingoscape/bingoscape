import { NextResponse } from 'next/server'
import { updateClanInviteLabel } from '@/app/actions/clan/update-clan-invite-label'
import { deleteClanInvite } from '@/app/actions/clan/delete-clan-invite'
import { revokeClanInvite } from '@/app/actions/clan/revoke-clan-invite'

// PATCH - Update invite label
export async function PATCH(
    req: Request,
    props: { params: Promise<{ clanId: string, inviteId: string }> }
) {
    const params = await props.params;
    try {
        const { label } = await req.json() as { label: string }
        const result = await updateClanInviteLabel({ inviteId: params.inviteId, label })
        
        if (result?.serverError) return NextResponse.json({ error: result.serverError }, { status: 500 })
        if (!result?.data?.success) return NextResponse.json({ error: result?.data?.error ?? "Failed to update invite" }, { status: 400 })
        
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
        const result = await deleteClanInvite({ inviteId: params.inviteId })
        
        if (result?.serverError) return NextResponse.json({ error: result.serverError }, { status: 500 })
        if (!result?.data?.success) return NextResponse.json({ error: result?.data?.error ?? "Failed to delete invite" }, { status: 400 })

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
            const result = await revokeClanInvite({ inviteId: params.inviteId })
            
            if (result?.serverError) return NextResponse.json({ error: result.serverError }, { status: 500 })
            if (!result?.data?.success) return NextResponse.json({ error: result?.data?.error ?? "Failed to revoke invite" }, { status: 400 })

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
