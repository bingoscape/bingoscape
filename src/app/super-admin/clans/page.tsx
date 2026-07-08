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
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10" />
        <div className="relative rounded-2xl border bg-gradient-to-r from-card to-muted/50 p-8 shadow-lg lg:p-12">
          <div className="mb-6 flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-4xl font-bold text-transparent lg:text-5xl">
                Clan Management
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Monitor and manage all platform clans
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
            <p className="font-medium text-green-700 dark:text-green-300">
              🛡️ Clan Overview
            </p>
            <p className="mt-1 text-sm text-green-600 dark:text-green-400">
              View clan details, manage members, and track clan activity across
              the platform.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clans</CardTitle>
            <div className="rounded-full bg-green-500/10 p-2">
              <Shield className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-3xl font-bold text-transparent">
              {clansData.totalCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Created on the platform
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Clans</CardTitle>
            <div className="rounded-full bg-blue-500/10 p-2">
              <Globe className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 bg-clip-text text-3xl font-bold text-transparent">
              {clansData.clans.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Public clans</p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Private Clans</CardTitle>
            <div className="rounded-full bg-purple-500/10 p-2">
              <Lock className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-3xl font-bold text-transparent">
              {clansData.clans.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Private clans</p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Showing Results
            </CardTitle>
            <div className="rounded-full bg-orange-500/10 p-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-3xl font-bold text-transparent">
              {clansData.clans.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? `Filtered by "${search}"` : "Current page"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clans Table */}
      <Card className="border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-full bg-green-500/10 p-2">
              <Shield className="h-5 w-5 text-green-500" />
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
