import { getAllEvents } from "@/app/actions/super-admin"
import { SuperAdminEventsTable } from "@/components/super-admin-events-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, CheckCircle, XCircle, TrendingUp } from "lucide-react"

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
  }>
}

export default async function SuperAdminEventsPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const page = Number.parseInt(searchParams.page ?? "1")
  const search = searchParams.search ?? ""

  const eventsData = await getAllEvents(page, 50, search)

  // Calculate event statistics
  const now = new Date()
  const activeEvents = eventsData.events.filter(event => {
    const startDate = new Date(event.startDate)
    const endDate = new Date(event.endDate)
    return now >= startDate && now <= endDate
  })

  const upcomingEvents = eventsData.events.filter(event => {
    const startDate = new Date(event.startDate)
    return now < startDate
  })

  const pastEvents = eventsData.events.filter(event => {
    const endDate = new Date(event.endDate)
    return now > endDate
  })

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10 rounded-2xl" />
        <div className="relative bg-gradient-to-r from-card to-muted/50 rounded-2xl p-8 lg:p-12 border shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-primary/10 p-3 rounded-full">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Event Management
              </h1>
              <p className="text-lg text-muted-foreground mt-2">Monitor and manage all platform events</p>
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <p className="text-purple-700 dark:text-purple-300 font-medium">🎯 Event Overview</p>
            <p className="text-purple-600 dark:text-purple-400 text-sm mt-1">
              View event details, manage participants, and track event progress across the platform.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-full">
              <Calendar className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent">
              {eventsData.totalCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Created on the platform</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Events</CardTitle>
            <div className="p-2 bg-green-500/10 rounded-full">
              <Clock className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
              {activeEvents.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Currently running</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-full">
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-600 bg-clip-text text-transparent">
              {upcomingEvents.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Scheduled events</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Showing Results</CardTitle>
            <div className="p-2 bg-orange-500/10 rounded-full">
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
              {eventsData.events.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? `Filtered by "${search}"` : "Current page"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/10 rounded-full">
              <Calendar className="h-5 w-5 text-purple-500" />
            </div>
            All Events
            <span className="text-sm font-normal text-muted-foreground">({eventsData.totalCount})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SuperAdminEventsTable {...eventsData} search={search} />
        </CardContent>
      </Card>
    </div>
  )
}
