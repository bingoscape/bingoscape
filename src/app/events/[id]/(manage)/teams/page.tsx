import { notFound } from "next/navigation"
import type { UUID } from "crypto"
import { getServerAuthSession } from "@/server/auth"
import { getEventById } from "@/server/queries/events"
import { hasPermission } from "@/server/authz"
import { getDraftSummary } from "@/server/draft/queries"
import Link from "next/link"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
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

  const { event } = data
  if (!(await hasPermission(event.id, "team:manage"))) {
    notFound()
  }

  const canManageDraft = await hasPermission(event.id, "draft:manage")
  const draft = canManageDraft ? await getDraftSummary(event.id) : null

  return (
    <main className="w-full">
      <Breadcrumbs
        items={[
          { label: event.title, href: `/events/${event.id}` },
          { label: "Teams", href: `/events/${event.id}/teams` },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="osrs-heading text-2xl">Manage teams</h2>
        {canManageDraft && (
          <Button variant="outline" asChild>
            <Link
              href={
                draft
                  ? `/events/${event.id}/draft`
                  : `/events/${event.id}/draft/setup`
              }
            >
              Team draft
            </Link>
          </Button>
        )}
      </div>
      <TeamManagement eventId={event.id} />
    </main>
  )
}
