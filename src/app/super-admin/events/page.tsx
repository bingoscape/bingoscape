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
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10" />
        <div className="relative rounded-2xl border bg-gradient-to-r from-card to-muted/50 p-8 shadow-lg lg:p-12">
          <div className="mb-6 flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-4xl font-bold text-transparent lg:text-5xl">
                Event Management
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Monitor and manage all platform events
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/20">
            <p className="font-medium text-purple-700 dark:text-purple-300">
              🎯 Event Overview
            </p>
            <p className="mt-1 text-sm text-purple-600 dark:text-purple-400">
              View event details, manage participants, and track event progress
              across the platform.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <div className="rounded-full bg-purple-500/10 p-2">
              <Calendar className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-3xl font-bold text-transparent">
              {eventsData.totalCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Created on the platform
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Events</CardTitle>
            <div className="rounded-full bg-green-500/10 p-2">
              <Clock className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-3xl font-bold text-transparent">
              {activeEvents.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Upcoming Events
            </CardTitle>
            <div className="rounded-full bg-blue-500/10 p-2">
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 bg-clip-text text-3xl font-bold text-transparent">
              {upcomingEvents.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Scheduled events
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Showing Results
            </CardTitle>
            <div className="rounded-full bg-orange-500/10 p-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-3xl font-bold text-transparent">
              {eventsData.events.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? `Filtered by "${search}"` : "Current page"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card className="border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-full bg-purple-500/10 p-2">
              <Calendar className="h-5 w-5 text-purple-500" />
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
