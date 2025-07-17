import { getSuperAdminStats } from "@/app/actions/super-admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Shield, Calendar, TrendingUp, Activity, BarChart3 } from "lucide-react"

export default async function SuperAdminDashboard() {
  const stats = await getSuperAdminStats()

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10 rounded-2xl" />
        <div className="relative bg-gradient-to-r from-card to-muted/50 rounded-2xl p-8 lg:p-12 border shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-primary/10 p-3 rounded-full">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Super Admin Dashboard
              </h1>
              <p className="text-lg text-muted-foreground mt-2">Monitor and manage your BingoScape platform</p>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-blue-700 dark:text-blue-300 font-medium">🎯 Platform Overview</p>
            <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">
              Real-time statistics and insights about your BingoScape community and events.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-full">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              {stats.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Registered users on the platform</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clans</CardTitle>
            <div className="p-2 bg-green-500/10 rounded-full">
              <Shield className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
              {stats.totalClans}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active clans created</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-full">
              <Calendar className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent">
              {stats.totalEvents}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Events created on platform</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Activity */}
      <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-orange-500/10 rounded-full">
              <TrendingUp className="h-5 w-5 text-orange-500" />
            </div>
            Platform Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Average users per clan</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  {stats.totalClans > 0 ? (stats.totalUsers / stats.totalClans).toFixed(1) : "0"}
                </span>
                <p className="text-xs text-muted-foreground">users</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Average events per clan</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
                  {stats.totalClans > 0 ? (stats.totalEvents / stats.totalClans).toFixed(1) : "0"}
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
