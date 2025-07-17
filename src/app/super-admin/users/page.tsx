import { getAllUsers } from "@/app/actions/super-admin"
import { SuperAdminUsersTable } from "@/components/super-admin-users-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, UserX, TrendingUp } from "lucide-react"

interface PageProps {
  searchParams: {
    page?: string
    search?: string
  }
}

export default async function SuperAdminUsersPage({ searchParams }: PageProps) {
  const page = Number.parseInt(searchParams.page ?? "1")
  const search = searchParams.search ?? ""

  const usersData = await getAllUsers(page, 50, search)

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10 rounded-2xl" />
        <div className="relative bg-gradient-to-r from-card to-muted/50 rounded-2xl p-8 lg:p-12 border shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-primary/10 p-3 rounded-full">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                User Management
              </h1>
              <p className="text-lg text-muted-foreground mt-2">Monitor and manage all platform users</p>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-blue-700 dark:text-blue-300 font-medium">👥 User Overview</p>
            <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">
              View user profiles, manage permissions, and track user activity across the platform.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-full">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              {usersData.totalCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Registered on the platform</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Users</CardTitle>
            <div className="p-2 bg-green-500/10 rounded-full">
              <UserCheck className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
              {usersData.users.filter(user => user.emailVerified).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Email verified</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Showing Results</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-full">
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent">
              {usersData.users.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? `Filtered by "${search}"` : "Current page"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-full">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            All Users
            <span className="text-sm font-normal text-muted-foreground">({usersData.totalCount})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SuperAdminUsersTable {...usersData} search={search} />
        </CardContent>
      </Card>
    </div>
  )
}
