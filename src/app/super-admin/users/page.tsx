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
        <div className="absolute inset-0 rounded-sm bg-primary/5" />
        <div className="osrs-panel relative p-8 shadow-lg lg:p-12">
          <div className="mb-6 flex items-center gap-4">
            <div className="rounded-sm bg-primary/10 p-3">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="osrs-heading text-primary text-4xl font-bold lg:text-5xl">
                User Management
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Monitor and manage all platform users
              </p>
            </div>
          </div>
          <div className="rounded-sm border border-info/40 bg-info/10 p-4">
            <p className="font-medium text-info">
              👥 User Overview
            </p>
            <p className="mt-1 text-sm text-info">
              View user profiles, manage permissions, and track user activity
              across the platform.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <div className="rounded-sm bg-info/10 p-2">
              <Users className="h-4 w-4 text-info" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {usersData.totalCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Registered on the platform
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Verified Users
            </CardTitle>
            <div className="rounded-sm bg-success/10 p-2">
              <UserCheck className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {usersData.users.filter((user) => user.emailVerified).length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Email verified</p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Showing Results
            </CardTitle>
            <div className="rounded-sm bg-pending/10 p-2">
              <TrendingUp className="h-4 w-4 text-pending" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {usersData.users.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? `Filtered by "${search}"` : "Current page"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="border-0 bg-linear-to-r from-card to-muted/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-sm bg-info/10 p-2">
              <Users className="h-5 w-5 text-info" />
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
