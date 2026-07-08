import { notFound } from "next/navigation"
import { getServerAuthSession } from "@/server/auth"
import { getEventById } from "@/app/actions/events"
import type { UUID } from "crypto"
import { TeamManagement } from "@/components/team-management"
import { TeamDisplay } from "@/components/team-display"
import { getCurrentTeamForUser } from "@/app/actions/team"
import { EventBingosClient } from "@/components/event-bingos-client"

export default async function EventBingosPage(props: {
  params: Promise<{ id: UUID }>
}) {
  const params = await props.params
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    notFound()
  }

  const [data, currentTeam] = await Promise.all([
    getEventById(params.id),
    getCurrentTeamForUser(params.id)
  ])

  if (!data) {
    notFound()
  }

  const { event, userRole } = data

  if (!userRole) {
    // Layout handles the non-participant view
    return null
  }

  const isAdminOrManagement = userRole === "admin" || userRole === "management"

  return (
    <main className="w-full">
      <section aria-label="Event boards">
        <EventBingosClient
          event={event}
          userRole={userRole}
          currentTeam={currentTeam}
          isAdminOrManagement={isAdminOrManagement}
        />
      </section>

      <section className="mt-12" aria-label="Team management">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold">Teams</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage team assignments and member roles
            </p>
          </div>
        </div>
        {isAdminOrManagement ? (
          <TeamManagement eventId={event.id} />
        ) : (
          <TeamDisplay eventId={event.id} />
        )}
      </section>
    </main>
  )
}
