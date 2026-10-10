import { getAllClans } from "@/app/actions/super-admin"
import { SuperAdminClansTable } from "@/components/super-admin-clans-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Lock, Globe, TrendingUp } from "lucide-react"

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
  }>
}

export default async function SuperAdminClansPage(props: PageProps) {
  const searchParams = await props.searchParams
  const page = Number.parseInt(searchParams.page ?? "1")
  const search = searchParams.search ?? ""

  const clansData = await getAllClans(page, 50, search)

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 rounded-sm bg-primary/5" />
        <div className="osrs-panel relative p-8 shadow-lg lg:p-12">
          <div className="mb-6 flex items-center gap-4">
            <div className="rounded-sm bg-primary/10 p-3">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="osrs-heading text-primary text-4xl font-bold lg:text-5xl">
                Clan Management
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Monitor and manage all platform clans
              </p>
            </div>
          </div>
          <div className="rounded-sm border border-success/40 bg-success/10 p-4">
            <p className="font-medium text-success">
              🛡️ Clan Overview
            </p>
            <p className="mt-1 text-sm text-success">
              View clan details, manage members, and track clan activity across
              the platform.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clans</CardTitle>
            <div className="rounded-sm bg-success/10 p-2">
              <Shield className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {clansData.totalCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Created on the platform
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Clans</CardTitle>
            <div className="rounded-sm bg-info/10 p-2">
              <Globe className="h-4 w-4 text-info" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {clansData.clans.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Public clans</p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Private Clans</CardTitle>
            <div className="rounded-sm bg-pending/10 p-2">
              <Lock className="h-4 w-4 text-pending" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {clansData.clans.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Private clans</p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Showing Results
            </CardTitle>
            <div className="rounded-sm bg-warning/10 p-2">
              <TrendingUp className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {clansData.clans.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? `Filtered by "${search}"` : "Current page"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clans Table */}
      <Card className="border-0 bg-linear-to-r from-card to-muted/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-sm bg-success/10 p-2">
              <Shield className="h-5 w-5 text-success" />
            </div>
            All Clans
            <span className="text-sm font-normal text-muted-foreground">
              ({clansData.totalCount})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SuperAdminClansTable {...clansData} search={search} />
        </CardContent>
      </Card>
    </div>
  )
}
