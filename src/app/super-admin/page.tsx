import { getSuperAdminStats } from "@/app/actions/super-admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Shield, Calendar, TrendingUp } from "lucide-react"

export default async function SuperAdminDashboard() {
  const stats = await getSuperAdminStats()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-4xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-lg text-muted-foreground">Overview of your BingoScape platform</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered users on the platform</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clans</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{stats.totalClans}</div>
            <p className="text-xs text-muted-foreground">Active clans created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">Events created on platform</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Platform Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Average users per clan</span>
              <span className="font-medium">
                {stats.totalClans > 0 ? (stats.totalUsers / stats.totalClans).toFixed(1) : "0"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Average events per clan</span>
              <span className="font-medium">
                {stats.totalClans > 0 ? (stats.totalEvents / stats.totalClans).toFixed(1) : "0"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
