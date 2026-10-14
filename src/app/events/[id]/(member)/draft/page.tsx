import Link from "next/link"
import { notFound } from "next/navigation"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { DraftRoom } from "@/components/draft/draft-room"
import { Button } from "@/components/ui/button"
import { getServerAuthSession } from "@/server/auth"
import { getEventCapabilities } from "@/server/authz"
import { settleExpiredDraft } from "@/server/draft/expire"
import { loadDraftSnapshot, loadPickQueue } from "@/server/draft/queries"
import { getEventById } from "@/server/queries/events"

/**
 * The team draft room, for every member of the Event. The Server Component
 * loads the snapshot; `DraftRoom` keeps it current by polling the state
 * endpoint and calling `router.refresh()`.
 */
export default async function EventDraftPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params

  const session = await getServerAuthSession()
  if (!session?.user) notFound()

  const [data, capabilities] = await Promise.all([
    getEventById(id),
    getEventCapabilities(id),
  ])
  if (!data || !capabilities.canViewDraft) notFound()

  // Lazy enforcement of the pick timer: opening the room settles an expired turn.
  await settleExpiredDraft(id)
  const snapshot = await loadDraftSnapshot(id)
  const initialQueue =
    snapshot && capabilities.canPick
      ? await loadPickQueue(snapshot.draftId, session.user.id)
      : []

  return (
    <main className="w-full space-y-4">
      <Breadcrumbs
        items={[
          { label: data.event.title, href: `/events/${id}` },
          { label: "Team draft", href: `/events/${id}/draft` },
        ]}
      />
      <h2 className="osrs-heading text-2xl">Team draft</h2>
      {snapshot ? (
        <DraftRoom
          eventId={id}
          snapshot={snapshot}
          viewerUserId={session.user.id}
          canManage={capabilities.canManageDraft}
          canPick={capabilities.canPick}
          initialQueue={initialQueue}
        />
      ) : (
        <div className="rounded-sm border border-dashed p-8 text-center">
          <p className="text-muted-foreground mb-4">
            This event has no team draft.
          </p>
          {capabilities.canManageDraft && (
            <Button asChild>
              <Link href={`/events/${id}/draft/setup`}>Set up a draft</Link>
            </Button>
          )}
        </div>
      )}
    </main>
  )
}
