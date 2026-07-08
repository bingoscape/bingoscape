import { getAllUsers } from "@/app/actions/super-admin"
import { SuperAdminUsersTable } from "@/components/super-admin-users-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, TrendingUp } from "lucide-react"

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
  }>
}

export default async function SuperAdminUsersPage(props: PageProps) {
  const searchParams = await props.searchParams
  const page = Number.parseInt(searchParams.page ?? "1")
  const search = searchParams.search ?? ""

  const usersData = await getAllUsers(page, 50, search)

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10" />
        <div className="relative rounded-2xl border bg-gradient-to-r from-card to-muted/50 p-8 shadow-lg lg:p-12">
          <div className="mb-6 flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-4xl font-bold text-transparent lg:text-5xl">
                User Management
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Monitor and manage all platform users
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
            <p className="font-medium text-blue-700 dark:text-blue-300">
              👥 User Overview
            </p>
            <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
              View user profiles, manage permissions, and track user activity
              across the platform.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <div className="rounded-full bg-blue-500/10 p-2">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-3xl font-bold text-transparent">
              {usersData.totalCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Registered on the platform
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Verified Users
            </CardTitle>
            <div className="rounded-full bg-green-500/10 p-2">
              <UserCheck className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-3xl font-bold text-transparent">
              {usersData.users.filter((user) => user.emailVerified).length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Email verified</p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Showing Results
            </CardTitle>
            <div className="rounded-full bg-purple-500/10 p-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-3xl font-bold text-transparent">
              {usersData.users.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? `Filtered by "${search}"` : "Current page"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-full bg-blue-500/10 p-2">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            All Users
            <span className="text-sm font-normal text-muted-foreground">
              ({usersData.totalCount})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SuperAdminUsersTable {...usersData} search={search} />
        </CardContent>
      </Card>
    </div>
  )
}
