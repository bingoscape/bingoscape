import { getAllEvents } from "@/app/actions/super-admin"
import { SuperAdminEventsTable } from "@/components/super-admin-events-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, CheckCircle, TrendingUp } from "lucide-react"

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
  }>
}

export default async function SuperAdminEventsPage(props: PageProps) {
  const searchParams = await props.searchParams
  const page = Number.parseInt(searchParams.page ?? "1")
  const search = searchParams.search ?? ""

  const eventsData = await getAllEvents(page, 50, search)

  // Calculate event statistics
  const now = new Date()
  const activeEvents = eventsData.events.filter((event) => {
    const startDate = new Date(event.startDate)
    const endDate = new Date(event.endDate)
    return now >= startDate && now <= endDate
  })

  const upcomingEvents = eventsData.events.filter((event) => {
    const startDate = new Date(event.startDate)
    return now < startDate
  })

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 rounded-sm bg-primary/5" />
        <div className="osrs-panel relative p-8 shadow-lg lg:p-12">
          <div className="mb-6 flex items-center gap-4">
            <div className="rounded-sm bg-primary/10 p-3">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="osrs-heading text-primary text-4xl font-bold lg:text-5xl">
                Event Management
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Monitor and manage all platform events
              </p>
            </div>
          </div>
          <div className="rounded-sm border border-pending/40 bg-pending/10 p-4">
            <p className="font-medium text-pending">
              🎯 Event Overview
            </p>
            <p className="mt-1 text-sm text-pending">
              View event details, manage participants, and track event progress
              across the platform.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <div className="rounded-sm bg-pending/10 p-2">
              <Calendar className="h-4 w-4 text-pending" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {eventsData.totalCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Created on the platform
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Events</CardTitle>
            <div className="rounded-sm bg-success/10 p-2">
              <Clock className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {activeEvents.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Upcoming Events
            </CardTitle>
            <div className="rounded-sm bg-info/10 p-2">
              <CheckCircle className="h-4 w-4 text-info" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {upcomingEvents.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Scheduled events
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Showing Results
            </CardTitle>
            <div className="rounded-sm bg-warning/10 p-2">
              <TrendingUp className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {eventsData.events.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? `Filtered by "${search}"` : "Current page"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card className="border-0 bg-linear-to-r from-card to-muted/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-sm bg-pending/10 p-2">
              <Calendar className="h-5 w-5 text-pending" />
            </div>
            All Events
            <span className="text-sm font-normal text-muted-foreground">
              ({eventsData.totalCount})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SuperAdminEventsTable {...eventsData} search={search} />
        </CardContent>
      </Card>
    </div>
  )
}
