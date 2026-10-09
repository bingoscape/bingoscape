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
  } catch {
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
        <div className="absolute inset-0 rounded-sm bg-primary/5" />
        <div className="osrs-panel relative p-8 shadow-lg lg:p-12">
          <Link href="/super-admin/clans">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Clans
            </Button>
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-4 flex items-center gap-4">
                <div className="rounded-sm bg-success/10 p-3">
                  <Shield className="h-8 w-8 text-success" />
                </div>
                <div>
                  <h1 className="osrs-heading text-primary text-4xl font-bold lg:text-5xl">
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
                        className="border-warning/20 bg-warning/10 text-warning"
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
        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <div className="rounded-sm bg-pending/10 p-2">
              <Users className="h-4 w-4 text-pending" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {totalMembers}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {roleBreakdown.admin > 0 && (
                <Badge
                  variant="outline"
                  className="border-pending/20 bg-pending/10 text-xs text-pending"
                >
                  {roleBreakdown.admin} admin
                  {roleBreakdown.admin !== 1 ? "s" : ""}
                </Badge>
              )}
              {roleBreakdown.management > 0 && (
                <Badge
                  variant="outline"
                  className="border-info/20 bg-info/10 text-xs text-info"
                >
                  {roleBreakdown.management} mgmt
                </Badge>
              )}
              {roleBreakdown.member > 0 && (
                <Badge
                  variant="outline"
                  className="border-success/20 bg-success/10 text-xs text-success"
                >
                  {roleBreakdown.member} member
                  {roleBreakdown.member !== 1 ? "s" : ""}
                </Badge>
              )}
              {roleBreakdown.guest > 0 && (
                <Badge
                  variant="outline"
                  className="border-border bg-muted text-xs text-muted-foreground"
                >
                  {roleBreakdown.guest} guest
                  {roleBreakdown.guest !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <div className="rounded-sm bg-info/10 p-2">
              <Calendar className="h-4 w-4 text-info" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {totalEvents}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {lockedEvents > 0 && (
                <Badge
                  variant="outline"
                  className="border-warning/20 bg-warning/10 text-xs text-warning"
                >
                  <Lock className="mr-1 h-3 w-3" />
                  {lockedEvents} locked
                </Badge>
              )}
              {publicEvents > 0 && (
                <Badge
                  variant="outline"
                  className="border-success/20 bg-success/10 text-xs text-success"
                >
                  <Globe className="mr-1 h-3 w-3" />
                  {publicEvents} public
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Submissions
            </CardTitle>
            <div className="rounded-sm bg-success/10 p-2">
              <ImageIcon className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {totalSubmissions}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Across all events
            </p>
          </CardContent>
        </Card>

        <Card className="transform border-0 bg-linear-to-r from-card to-muted/50 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Members
            </CardTitle>
            <div className="rounded-sm bg-warning/10 p-2">
              <BowArrow className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="osrs-heading text-primary text-3xl font-bold">
              {activeMembers}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Members Table Section */}
      <Card className="border-0 bg-linear-to-r from-card to-muted/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-sm bg-pending/10 p-2">
              <Users className="h-5 w-5 text-pending" />
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
        <Card className="border-0 bg-linear-to-r from-card to-muted/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="rounded-sm bg-info/10 p-2">
                <Calendar className="h-5 w-5 text-info" />
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
                            className="border-warning/20 bg-warning/10 text-xs text-warning"
                          >
                            <Lock className="mr-1 h-3 w-3" />
                            Locked
                          </Badge>
                        )}
                        {event.public && (
                          <Badge
                            variant="outline"
                            className="border-success/20 bg-success/10 text-xs text-success"
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
