import { getAllClans } from "@/app/actions/super-admin"
import { SuperAdminClansTable } from "@/components/super-admin-clans-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PageProps {
  searchParams: {
    page?: string
    search?: string
  }
}

export default async function SuperAdminClansPage({ searchParams }: PageProps) {
  const page = Number.parseInt(searchParams.page ?? "1")
  const search = searchParams.search ?? ""

  const clansData = await getAllClans(page, 50, search)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Clans</h2>
        <p className="text-muted-foreground">Manage all clans on the platform</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clans ({clansData.totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          <SuperAdminClansTable {...clansData} search={search} />
        </CardContent>
      </Card>
    </div>
  )
}
