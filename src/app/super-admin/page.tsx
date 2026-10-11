import type { Metadata } from "next"
import {
  Calendar,
  CalendarClock,
  Radio,
  Shield,
  ShieldAlert,
  Users,
} from "lucide-react"

import { PageHeader } from "@/components/super-admin/page-header"
import { Stat } from "@/components/super-admin/stat"
import { getSuperAdminOverview } from "@/server/super-admin/queries"

export const metadata: Metadata = { title: "Overview - Super admin" }

export default async function SuperAdminOverviewPage() {
  const overview = await getSuperAdminOverview()

  return (
    <>
      <PageHeader
        title="Super admin"
        description="Platform totals. Each number opens the list behind it."
      />
      <h2 className="sr-only">Platform totals</h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <li>
          <Stat
            label="Users"
            value={overview.users}
            icon={Users}
            href="/super-admin/users"
          />
        </li>
        <li>
          <Stat
            label="Clans"
            value={overview.clans}
            icon={Shield}
            href="/super-admin/clans"
          />
        </li>
        <li>
          <Stat
            label="Events"
            value={overview.events}
            icon={Calendar}
            href="/super-admin/events"
          />
        </li>
        <li>
          <Stat
            label="Live events"
            value={overview.liveEvents}
            icon={Radio}
            href="/super-admin/events?filter=live"
          />
        </li>
        <li>
          <Stat
            label="Upcoming events"
            value={overview.upcomingEvents}
            icon={CalendarClock}
            href="/super-admin/events?filter=upcoming"
          />
        </li>
        <li>
          <Stat
            label="Clans without an owner"
            value={overview.clansWithoutOwner}
            icon={ShieldAlert}
            href="/super-admin/clans?filter=no-owner"
          />
        </li>
      </ul>
    </>
  )
}
