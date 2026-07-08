import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getServerAuthSession } from "@/server/auth"
import { getEventSubmissions } from "@/app/actions/getSubmissions"
import { Button } from "@/components/ui/button"
import { ShieldCheck, ArrowLeft } from "lucide-react"
import type { UUID } from "crypto"
import { ReviewSubmissionsClient } from "./client"
import { getEventById } from "@/server/queries/events"

export default async function ReviewSubmissionsPage(props: {
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

  if (userRole !== "admin" && userRole !== "management") {
    notFound()
  }

  // Fetch all submissions for the event
  const teamTileSubmissions = await getEventSubmissions(params.id)

  const teamsMap = new Map()
  teamTileSubmissions.forEach((sub) => {
    if (sub.team && !teamsMap.has(sub.team.id)) {
      teamsMap.set(sub.team.id, sub.team)
    }
  })
  const teams = Array.from(teamsMap.values())

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
              <Link href={`/events/${params.id}/admin`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin Dashboard
              </Link>
            </Button>
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Review Submissions
          </h1>
          <p className="mt-1 text-muted-foreground">Managing: {event.title}</p>
        </div>
      </div>

      <main className="min-h-[60vh] space-y-6 rounded-3xl border bg-gradient-to-br from-slate-50 to-slate-100 p-6 shadow-inner dark:from-slate-900/50 dark:to-slate-900 md:p-8">
        <ReviewSubmissionsClient
          teamTileSubmissions={teamTileSubmissions}
          teams={teams}
          isSubmissionsLocked={event.locked}
        />
      </main>
    </div>
  )
}
