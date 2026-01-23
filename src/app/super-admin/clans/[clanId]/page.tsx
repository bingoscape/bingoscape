import {
  getClanDetails,
  getClanMemberActivity,
} from "@/app/actions/super-admin"
import { SuperAdminClanMembersTable } from "@/components/super-admin-clan-members-table"
import { SuperAdminClanEditModal } from "@/components/super-admin-clan-edit-modal"
import { SuperAdminClanDeleteModal } from "@/components/super-admin-clan-delete-modal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  Users,
  Calendar,
  ArrowLeft,
  Lock,
  Globe,
  BowArrow,
  Image as ImageIcon,
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

interface PageProps {
  params: Promise<{
    clanId: string
  }>
}

export default async function SuperAdminClanDetailPage(props: PageProps) {
  const params = await props.params
  let clan
  let memberActivity

  try {
    clan = await getClanDetails(params.clanId)
    memberActivity = await getClanMemberActivity(params.clanId)
  } catch (error) {
    console.error("Failed to load clan details:", error)
    notFound()
  }

  // Merge member data with activity data
  const membersWithActivity = clan.members.map((member) => {
    const activity = memberActivity.find((a) => a.userId === member.userId)
    return {
      ...member,
      submissionCount: activity?.submissionCount ?? 0,
      lastSeen: activity?.lastSeen ?? null,
    }
  })

  // Calculate statistics
  const totalMembers = membersWithActivity.length
  const totalEvents = clan.events.length
  const totalSubmissions = membersWithActivity.reduce(
    (sum, m) => sum + m.submissionCount,
    0
  )
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const activeMembers = membersWithActivity.filter(
    (m) => m.lastSeen && new Date(m.lastSeen) > thirtyDaysAgo
  ).length

  // Role breakdown
  const roleBreakdown = {
    admin: membersWithActivity.filter((m) => m.role === "admin").length,
    management: membersWithActivity.filter((m) => m.role === "management")
      .length,
    member: membersWithActivity.filter((m) => m.role === "member").length,
    guest: membersWithActivity.filter((m) => m.role === "guest").length,
  }

  // Event status breakdown
  const lockedEvents = clan.events.filter((e) => e.locked).length
  const publicEvents = clan.events.filter((e) => e.public).length

  // Get owner info
  const owner = clan.members.find((m) => m.userId === clan.ownerId)

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 via-transparent to-green-500/10" />
        <div className="relative rounded-2xl border bg-gradient-to-r from-card to-muted/50 p-8 shadow-lg lg:p-12">
          <Link href="/super-admin/clans">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Clans
            </Button>
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-4 flex items-center gap-4">
                <div className="rounded-full bg-green-500/10 p-3">
                  <Shield className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <h1 className="bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-4xl font-bold text-transparent lg:text-5xl">
                    {clan.name}
                  </h1>
                </div>
              </div>

              {clan.description && (
                <p className="mb-4 text-lg text-muted-foreground">
                  {clan.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <Badge variant="outline" className="bg-muted">
                  Created {new Date(clan.createdAt).toLocaleDateString()}
                </Badge>
                {owner && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Owner:
                    </span>
                    <Link
                      href={`/super-admin/users/${owner.userId}`}
                      className="hover:underline"
                    >
                      <Badge
                        variant="outline"
                        className="border-amber-500/20 bg-amber-500/10 text-amber-600"
                      >
                        {owner.user.name ?? owner.user.email}
                      </Badge>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <SuperAdminClanEditModal clan={clan} />
              <SuperAdminClanDeleteModal clan={clan} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <div className="rounded-full bg-purple-500/10 p-2">
              <Users className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-3xl font-bold text-transparent">
              {totalMembers}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {roleBreakdown.admin > 0 && (
                <Badge
                  variant="outline"
                  className="border-purple-500/20 bg-purple-500/10 text-xs text-purple-500"
                >
                  {roleBreakdown.admin} admin
                  {roleBreakdown.admin !== 1 ? "s" : ""}
                </Badge>
              )}
              {roleBreakdown.management > 0 && (
                <Badge
                  variant="outline"
                  className="border-blue-500/20 bg-blue-500/10 text-xs text-blue-500"
                >
                  {roleBreakdown.management} mgmt
                </Badge>
              )}
              {roleBreakdown.member > 0 && (
                <Badge
                  variant="outline"
                  className="border-green-500/20 bg-green-500/10 text-xs text-green-500"
                >
                  {roleBreakdown.member} member
                  {roleBreakdown.member !== 1 ? "s" : ""}
                </Badge>
              )}
              {roleBreakdown.guest > 0 && (
                <Badge
                  variant="outline"
                  className="border-gray-500/20 bg-gray-500/10 text-xs text-gray-500"
                >
                  {roleBreakdown.guest} guest
                  {roleBreakdown.guest !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <div className="rounded-full bg-blue-500/10 p-2">
              <Calendar className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 bg-clip-text text-3xl font-bold text-transparent">
              {totalEvents}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {lockedEvents > 0 && (
                <Badge
                  variant="outline"
                  className="border-orange-500/20 bg-orange-500/10 text-xs text-orange-500"
                >
                  <Lock className="mr-1 h-3 w-3" />
                  {lockedEvents} locked
                </Badge>
              )}
              {publicEvents > 0 && (
                <Badge
                  variant="outline"
                  className="border-green-500/20 bg-green-500/10 text-xs text-green-500"
                >
                  <Globe className="mr-1 h-3 w-3" />
                  {publicEvents} public
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Submissions
            </CardTitle>
            <div className="rounded-full bg-green-500/10 p-2">
              <ImageIcon className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-3xl font-bold text-transparent">
              {totalSubmissions}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Across all events
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Members
            </CardTitle>
            <div className="rounded-full bg-orange-500/10 p-2">
              <BowArrow className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-3xl font-bold text-transparent">
              {activeMembers}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Members Table Section */}
      <Card className="border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-full bg-purple-500/10 p-2">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            Clan Members
            <span className="text-sm font-normal text-muted-foreground">
              ({totalMembers})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SuperAdminClanMembersTable
            members={membersWithActivity}
            clanId={clan.id}
            ownerId={clan.ownerId}
          />
        </CardContent>
      </Card>

      {/* Events Section */}
      {clan.events.length > 0 && (
        <Card className="border-0 bg-gradient-to-r from-card to-muted/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="rounded-full bg-blue-500/10 p-2">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              Clan Events
              <span className="text-sm font-normal text-muted-foreground">
                ({totalEvents})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {clan.events.slice(0, 10).map((event) => (
                <Link key={event.id} href={`/super-admin/events/${event.id}`}>
                  <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="line-clamp-1 text-lg">
                        {event.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {event.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          {new Date(event.startDate).toLocaleDateString()}
                        </Badge>
                        {event.locked && (
                          <Badge
                            variant="outline"
                            className="border-orange-500/20 bg-orange-500/10 text-xs text-orange-500"
                          >
                            <Lock className="mr-1 h-3 w-3" />
                            Locked
                          </Badge>
                        )}
                        {event.public && (
                          <Badge
                            variant="outline"
                            className="border-green-500/20 bg-green-500/10 text-xs text-green-500"
                          >
                            <Globe className="mr-1 h-3 w-3" />
                            Public
                          </Badge>
                        )}
                      </div>
                      {event.creator && (
                        <p className="text-xs text-muted-foreground">
                          Created by {event.creator.name ?? event.creator.email}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            {clan.events.length > 10 && (
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Showing 10 of {totalEvents} events
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
