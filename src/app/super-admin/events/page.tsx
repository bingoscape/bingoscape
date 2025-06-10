import { getAllEvents } from "@/app/actions/super-admin"
import { SuperAdminEventsTable } from "@/components/super-admin-events-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PageProps {
  searchParams: {
    page?: string
    search?: string
  }
}

export default async function SuperAdminEventsPage({ searchParams }: PageProps) {
  const page = Number.parseInt(searchParams.page ?? "1")
  const search = searchParams.search ?? ""

  const eventsData = await getAllEvents(page, 50, search)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Events</h2>
        <p className="text-muted-foreground">Manage all events on the platform</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Events ({eventsData.totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          <SuperAdminEventsTable {...eventsData} search={search} />
        </CardContent>
      </Card>
    </div>
  )
}
