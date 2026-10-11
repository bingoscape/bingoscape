import EventList from "@/components/eventlist"
import { LandingPage } from "@/components/landing/landing-page"
import { getServerAuthSession } from "@/server/auth"
import { parseRoleFilter, type RoleFilter } from "@/lib/dashboard-events"

import { Suspense } from "react"
import { getEvents } from "@/server/queries/events"

async function LoggedInDashboard({
  userId,
  roleFilter,
}: {
  userId: string
  roleFilter: RoleFilter
}) {
  const events = await getEvents(userId)

  return (
    <EventList userId={userId} initialEvents={events} roleFilter={roleFilter} />
  )
}

function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading events"
      className="space-y-6 motion-safe:animate-pulse"
    >
      <div className="h-12 w-48 rounded-sm bg-muted" />
      <div className="h-10 w-64 rounded-sm bg-muted" />
      <div className="h-64 rounded-sm bg-muted" />
    </div>
  )
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [session, params] = await Promise.all([
    getServerAuthSession(),
    searchParams,
  ])

  return (
    <div className="bg-background text-foreground">
      <main id="main" className="container mx-auto px-4 py-6 sm:py-8">
        {session ? (
          <Suspense fallback={<DashboardSkeleton />}>
            <LoggedInDashboard
              userId={session.user.id}
              roleFilter={parseRoleFilter(params.role)}
            />
          </Suspense>
        ) : (
          <LandingPage />
        )}
      </main>
    </div>
  )
}
