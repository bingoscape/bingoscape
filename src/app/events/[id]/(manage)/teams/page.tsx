import { notFound } from "next/navigation"
import type { UUID } from "crypto"
import { getServerAuthSession } from "@/server/auth"
import { getEventById } from "@/server/queries/events"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { TeamManagement } from "@/components/team-management"

/** Team management for admins / management (moved out of the workspace). */
export default async function EventTeamsPage(props: {
  params: Promise<{ id: UUID }>
}) {
  const params = await props.params

  const session = await getServerAuthSession()
  if (!session?.user) {
    notFound()
  }

  const data = await getEventById(params.id)
  if (!data) {
    notFound()
  }

  const { event, userRole } = data
  if (userRole !== "admin" && userRole !== "management") {
    notFound()
  }

  return (
    <main className="w-full">
      <Breadcrumbs
        items={[
          { label: event.title, href: `/events/${event.id}` },
          { label: "Teams", href: `/events/${event.id}/teams` },
        ]}
      />
      <h2 className="osrs-heading mb-4 text-2xl">Manage teams</h2>
      <TeamManagement eventId={event.id} />
    </main>
  )
}
