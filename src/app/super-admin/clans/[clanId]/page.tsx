import { getClanDetails, getClanMemberActivity } from "@/app/actions/super-admin"
import { SuperAdminClanMembersTable } from "@/components/super-admin-clan-members-table"
import { SuperAdminClanEditModal } from "@/components/super-admin-clan-edit-modal"
import { SuperAdminClanDeleteModal } from "@/components/super-admin-clan-delete-modal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Shield, Users, Calendar, Image, Activity, ArrowLeft, Lock, Globe } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

interface PageProps {
  params: Promise<{
    clanId: string
  }>
}

export default async function SuperAdminClanDetailPage(props: PageProps) {
  const params = await props.params;
  let clan
  let memberActivity

  try {
    clan = await getClanDetails(params.clanId)
    memberActivity = await getClanMemberActivity(params.clanId)
  } catch (error) {
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
  const totalSubmissions = membersWithActivity.reduce((sum, m) => sum + m.submissionCount, 0)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const activeMembers = membersWithActivity.filter((m) => m.lastSeen && new Date(m.lastSeen) > thirtyDaysAgo).length

  // Role breakdown
  const roleBreakdown = {
    admin: membersWithActivity.filter((m) => m.role === "admin").length,
    management: membersWithActivity.filter((m) => m.role === "management").length,
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
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-green-500/10 rounded-2xl" />
        <div className="relative bg-gradient-to-r from-card to-muted/50 rounded-2xl p-8 lg:p-12 border shadow-lg">
          <Link href="/super-admin/clans">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clans
            </Button>
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-green-500/10 p-3 rounded-full">
                  <Shield className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
                    {clan.name}
                  </h1>
                </div>
              </div>

              {clan.description && (
                <p className="text-lg text-muted-foreground mb-4">{clan.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <Badge variant="outline" className="bg-muted">
                  Created {new Date(clan.createdAt).toLocaleDateString()}
                </Badge>
                {owner && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Owner:</span>
                    <Link href={`/super-admin/users/${owner.userId}`} className="hover:underline">
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
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
        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-full">
              <Users className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent">
              {totalMembers}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {roleBreakdown.admin > 0 && (
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                  {roleBreakdown.admin} admin{roleBreakdown.admin !== 1 ? "s" : ""}
                </Badge>
              )}
              {roleBreakdown.management > 0 && (
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">
                  {roleBreakdown.management} mgmt
                </Badge>
              )}
              {roleBreakdown.member > 0 && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                  {roleBreakdown.member} member{roleBreakdown.member !== 1 ? "s" : ""}
                </Badge>
              )}
              {roleBreakdown.guest > 0 && (
                <Badge variant="outline" className="text-xs bg-gray-500/10 text-gray-500 border-gray-500/20">
                  {roleBreakdown.guest} guest{roleBreakdown.guest !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-full">
              <Calendar className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-600 bg-clip-text text-transparent">
              {totalEvents}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {lockedEvents > 0 && (
                <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">
                  <Lock className="h-3 w-3 mr-1" />
                  {lockedEvents} locked
                </Badge>
              )}
              {publicEvents > 0 && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                  <Globe className="h-3 w-3 mr-1" />
                  {publicEvents} public
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <div className="p-2 bg-green-500/10 rounded-full">
              <Image className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
              {totalSubmissions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all events</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <div className="p-2 bg-orange-500/10 rounded-full">
              <Activity className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
              {activeMembers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Members Table Section */}
      <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/10 rounded-full">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            Clan Members
            <span className="text-sm font-normal text-muted-foreground">({totalMembers})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SuperAdminClanMembersTable members={membersWithActivity} clanId={clan.id} ownerId={clan.ownerId} />
        </CardContent>
      </Card>

      {/* Events Section */}
      {clan.events.length > 0 && (
        <Card className="bg-gradient-to-r from-card to-muted/50 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-full">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              Clan Events
              <span className="text-sm font-normal text-muted-foreground">({totalEvents})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {clan.events.slice(0, 10).map((event) => (
                <Link key={event.id} href={`/super-admin/events/${event.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg line-clamp-1">{event.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          {new Date(event.startDate).toLocaleDateString()}
                        </Badge>
                        {event.locked && (
                          <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">
                            <Lock className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                        {event.public && (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                            <Globe className="h-3 w-3 mr-1" />
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
                <p className="text-sm text-muted-foreground">Showing 10 of {totalEvents} events</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
