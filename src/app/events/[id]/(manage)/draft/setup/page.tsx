import { notFound, redirect } from "next/navigation"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { DraftSetupForm } from "@/components/draft/draft-setup-form"
import { getServerAuthSession } from "@/server/auth"
import { hasPermission } from "@/server/authz"
import { getDraftSummary, listDraftCandidates } from "@/server/draft/queries"
import { getEventById } from "@/server/queries/events"

/**
 * Setup of the team draft (order, rounds, timer, captains) for managers. An
 * Event that already has a live draft goes straight to its room: cancel it
 * there to start over.
 */
export default async function EventDraftSetupPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params

  const session = await getServerAuthSession()
  if (!session?.user) notFound()

  const data = await getEventById(id)
  if (!data) notFound()
  if (!(await hasPermission(id, "draft:manage"))) notFound()

  if (await getDraftSummary(id)) redirect(`/events/${id}/draft`)

  const candidates = await listDraftCandidates(id)

  return (
    <main className="w-full space-y-4">
      <Breadcrumbs
        items={[
          { label: data.event.title, href: `/events/${id}` },
          { label: "Team draft", href: `/events/${id}/draft` },
          { label: "Set up", href: `/events/${id}/draft/setup` },
        ]}
      />
      <h2 className="osrs-heading text-2xl">Set up a team draft</h2>
      <p className="text-muted-foreground">
        Captains take turns picking players from the participants who are not on
        a team yet. Teams are created when you start the draft, and the drafted
        players only join them when you apply the result.
      </p>
      <DraftSetupForm eventId={id} candidates={candidates} />
    </main>
  )
}
