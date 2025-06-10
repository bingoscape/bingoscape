import { getAllUsers } from "@/app/actions/super-admin"
import { SuperAdminUsersTable } from "@/components/super-admin-users-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Users</h2>
        <p className="text-muted-foreground">Manage all users on the platform</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users ({usersData.totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          <SuperAdminUsersTable {...usersData} search={search} />
        </CardContent>
      </Card>
    </div>
  )
}
