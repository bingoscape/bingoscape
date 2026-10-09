import { getSuperAdminStats } from "@/app/actions/super-admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Users,
  Shield,
  Calendar,
  TrendingUp,
  Activity,
  BarChart3,
} from "lucide-react"

export default async function SuperAdminDashboard() {
  const stats = await getSuperAdminStats()

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 rounded-sm bg-primary/5" />
        <div className="osrs-panel relative p-8 shadow-lg lg:p-12">
          <div className="mb-6 flex items-center gap-4">
            <div className="rounded-sm bg-primary/10 p-3">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="osrs-heading text-primary text-4xl font-bold lg:text-5xl">
                Super Admin Dashboard
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Monitor and manage your BingoScape platform
              </p>
            </div>
          </div>
          <div className="rounded-sm border border-info/40 bg-info/10 p-4">
            <p className="font-medium text-info">
              🎯 Platform Overview
            </p>
            <p className="mt-1 text-sm text-info">
              Real-time statistics and insights about your BingoScape community
              and events.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <div className="rounded-sm bg-info/10 p-2">
              <Users className="h-4 w-4 text-info" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {stats.totalUsers}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Registered users on the platform
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clans</CardTitle>
            <div className="rounded-sm bg-success/10 p-2">
              <Shield className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {stats.totalClans}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Active clans created
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <div className="rounded-sm bg-pending/10 p-2">
              <Calendar className="h-4 w-4 text-pending" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {stats.totalEvents}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Events created on platform
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Activity */}
      <Card className="border-0 bg-linear-to-r from-card to-muted/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-sm bg-warning/10 p-2">
              <TrendingUp className="h-5 w-5 text-warning" />
            </div>
            Platform Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-sm bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Average users per clan
                </span>
              </div>
              <div className="text-right">
                <span className="osrs-heading text-primary text-2xl font-bold">
                  {stats.totalClans > 0
                    ? (stats.totalUsers / stats.totalClans).toFixed(1)
                    : "0"}
                </span>
                <p className="text-xs text-muted-foreground">users</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-sm bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Average events per clan
                </span>
              </div>
              <div className="text-right">
                <span className="osrs-heading text-primary text-2xl font-bold">
                  {stats.totalClans > 0
                    ? (stats.totalEvents / stats.totalClans).toFixed(1)
                    : "0"}
                </span>
                <p className="text-xs text-muted-foreground">events</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
