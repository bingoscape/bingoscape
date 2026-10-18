import { notFound } from "next/navigation"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { DraftLobby } from "@/components/draft/draft-lobby"
import { DraftRoom } from "@/components/draft/draft-room"
import { getServerAuthSession } from "@/server/auth"
import { getEventCapabilities } from "@/server/authz"
import { settleExpiredDraft } from "@/server/draft/expire"
import { loadDraftSnapshot, loadPickQueue } from "@/server/draft/queries"
import { getEventById } from "@/server/queries/events"

/**
 * The team draft room, for every member of the Event. The Server Component
 * loads the snapshot; `DraftRoom` keeps it current (stream, polling as the
 * fallback) and calls `router.refresh()` when the draft changes phase. Without
 * a draft the page is a waiting room (`DraftLobby`) that refreshes itself when
 * one is created.
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
        <DraftLobby eventId={id} canManage={capabilities.canManageDraft} />
      )}
    </main>
  )
}
