import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getServerAuthSession } from "@/server/auth"
import {
  getPendingRegistrationCount,
  calculateEventPrizePool,
} from "@/app/actions/events"
import { StatCard, ActionTile } from "./components/dashboard-ui"
import { Button } from "@/components/ui/button"
import {
  Users,
  FileText,
  Settings,
  Megaphone,
  Download,
  Trophy,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react"
import type { UUID } from "crypto"
import { db } from "@/server/db"
import {
  teamTileSubmissions,
  teams,
  eventParticipants,
} from "@/server/db/schema"
import { eq, and, sql } from "drizzle-orm"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { getEventById } from "@/server/queries/events"

export default async function ManageEventPage(props: {
  params: Promise<{ id: UUID }>
}) {
  const params = await props.params
  const session = await getServerAuthSession()

  if (!session || !session.user) {
    redirect("/login")
  }

  const eventData = await getEventById(params.id)

  if (!eventData) {
    notFound()
  }

  const { event, userRole } = eventData

  // Ensure only event admins can access this page
  if (userRole !== "admin") {
    notFound()
  }

  // Fetch Data for Stats (in parallel where possible)
  const [
    pendingRegistrationsCount,
    prizePoolData,
    pendingSubmissionsResult,
    participantsResult,
    teamsResult,
    approvedSubmissionsResult,
  ] = await Promise.all([
    getPendingRegistrationCount(params.id),
    calculateEventPrizePool(params.id),
    // Pending Submissions
    db
      .select({ count: sql<number>`count(*)` })
      .from(teamTileSubmissions)
      .innerJoin(teams, eq(teamTileSubmissions.teamId, teams.id))
      .where(
        and(
          eq(teams.eventId, params.id),
          eq(teamTileSubmissions.status, "pending")
        )
      ),
    // Total Active Participants
    db
      .select({ count: sql<number>`count(*)` })
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, params.id)),
    // Total Teams
    db
      .select({ count: sql<number>`count(*)` })
      .from(teams)
      .where(eq(teams.eventId, params.id)),
    // Total Approved Submissions
    db
      .select({ count: sql<number>`count(*)` })
      .from(teamTileSubmissions)
      .innerJoin(teams, eq(teamTileSubmissions.teamId, teams.id))
      .where(
        and(
          eq(teams.eventId, params.id),
          eq(teamTileSubmissions.status, "approved")
        )
      ),
  ])

  const pendingSubmissionsCount = Number(
    pendingSubmissionsResult[0]?.count || 0
  )
  const totalParticipants = Number(participantsResult[0]?.count || 0)
  const totalTeams = Number(teamsResult[0]?.count || 0)
  const totalApproved = Number(approvedSubmissionsResult[0]?.count || 0)

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header & Navigation */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-muted-foreground"
            >
              <Link href={`/events/${params.id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Event
              </Link>
            </Button>
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Admin Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">Managing: {event.title}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/events/${params.id}`} target="_blank">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Live Event
          </Link>
        </Button>
      </div>

      {/* Main Content Area */}
      <main className="space-y-6 rounded-3xl border bg-gradient-to-br from-slate-50 to-slate-100 p-6 shadow-inner dark:from-slate-900/50 dark:to-slate-900 md:p-8">
        {/* Quick Stats Row */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Teams"
            value={totalTeams.toString()}
            icon={<Users />}
          />
          <StatCard
            title="Active Participants"
            value={totalParticipants.toString()}
            icon={<Users />}
          />
          <StatCard
            title="Pending Actions"
            value={(
              pendingRegistrationsCount + pendingSubmissionsCount
            ).toString()}
            alert={true}
            icon={<FileText />}
          />
          <StatCard
            title="Prize Pool"
            value={`${formatRunescapeGold(prizePoolData.totalPrizePool)} GP`}
            icon={<Trophy />}
          />
        </section>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 gap-6 pt-4 lg:grid-cols-3">
          {/* Left: Actions (60-70%) */}
          <section className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border bg-white/50 p-6 backdrop-blur-sm dark:bg-black/20">
              <h2 className="mb-6 text-xl font-bold">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <ActionTile
                  href={`/events/${params.id}/admin/submissions`}
                  label="Review Submissions"
                  icon={<FileText />}
                  badgeCount={pendingSubmissionsCount}
                />
                <ActionTile
                  href={`/events/${params.id}?tab=participants`}
                  label="Manage Registration"
                  icon={<Users />}
                  badgeCount={pendingRegistrationsCount}
                />
                <ActionTile
                  href={`/events/${params.id}?tab=teams`}
                  label="Manage Teams"
                  icon={<ShieldCheck />}
                />
                {/* Placeholders for future expanded admin functionality */}
                <ActionTile
                  href={`#`}
                  label="Announcements"
                  icon={<Megaphone />}
                />
                <ActionTile
                  href={`#`}
                  label="Export Data"
                  icon={<Download />}
                />
                <ActionTile
                  href={`#`}
                  label="Event Settings"
                  icon={<Settings />}
                />
              </div>
            </div>
          </section>

          {/* Right: Insights & Progress */}
          <section className="space-y-6">
            <div className="h-full rounded-2xl border bg-white/50 p-6 backdrop-blur-sm dark:bg-black/20">
              <h2 className="mb-6 text-xl font-bold">Event Insights</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 flex items-center justify-between text-sm font-medium text-muted-foreground">
                    <span>Approved Completions</span>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </h3>
                  <p className="text-3xl font-bold">{totalApproved}</p>
                </div>

                <div className="border-t pt-6 dark:border-slate-800">
                  <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                    At a glance
                  </h3>
                  <ul className="space-y-3 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">
                        Requires Approval
                      </span>
                      <span className="font-medium">
                        {event.requiresApproval ? "Yes" : "No"}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Locked</span>
                      <span className="font-medium text-amber-500">
                        {event.locked ? "Yes" : "No"}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Start Date</span>
                      <span className="font-medium">
                        {new Date(event.startDate).toLocaleDateString()}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">End Date</span>
                      <span className="font-medium">
                        {new Date(event.endDate).toLocaleDateString()}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
