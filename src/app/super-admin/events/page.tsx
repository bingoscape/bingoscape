import type { Metadata } from "next"

import { EventsTable } from "@/components/super-admin/events-table"
import { PageHeader } from "@/components/super-admin/page-header"
import { parseListParams, type RawSearchParams } from "@/lib/admin-list-params"
import { plural } from "@/lib/super-admin-format"
import { EVENT_LIST_CONFIG, listEvents } from "@/server/super-admin/queries"

export const metadata: Metadata = { title: "Events - Super admin" }

interface PageProps {
  searchParams: Promise<RawSearchParams>
}

export default async function SuperAdminEventsPage({
  searchParams,
}: PageProps) {
  const params = parseListParams(await searchParams, EVENT_LIST_CONFIG)
  const data = await listEvents(params)

  return (
    <>
      <PageHeader
        title="Events"
        breadcrumbs={[{ label: "Events" }]}
        meta={
          <span>
            {plural(data.totalCount, "event")}
            {params.filter || params.q ? " match" : " in total"}
          </span>
        }
      />
      <EventsTable
        data={data}
        params={params}
        basePath="/super-admin/events"
        idPrefix="events"
      />
    </>
  )
}
