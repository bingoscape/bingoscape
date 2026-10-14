import Link from "next/link"
import { notFound } from "next/navigation"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { DraftAnalyticsPanel } from "@/components/draft/recap/draft-analytics-panel"
import { FinalRosters } from "@/components/draft/recap/final-rosters"
import { PickHistoryTable } from "@/components/draft/recap/pick-history-table"
import { ShareRecapImage } from "@/components/draft/recap/share-recap-image"
import { UnassignedList } from "@/components/draft/unassigned-list"
import { Button } from "@/components/ui/button"
import { getServerAuthSession } from "@/server/auth"
import { getEventCapabilities } from "@/server/authz"
import { loadDraftAnalytics } from "@/server/draft/analytics"
import { loadDraftSnapshot } from "@/server/draft/queries"
import { getEventById } from "@/server/queries/events"

/**
 * The recap of a finished team draft, for every member of the Event: the final
 * rosters, a "Share as image" for Discord and the pick history. Managers also
 * get the analytics (reach and steal picks, time per pick, auto-pick rate and
 * the balance gap to the optimiser). Read-only; nothing here is public.
 */
export default async function EventDraftRecapPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params

  const session = await getServerAuthSession()
  if (!session?.user) notFound()

  const [data, capabilities] = await Promise.all([
    getEventById(id),
    getEventCapabilities(id),
  ])
  if (!data || !capabilities.canViewDraft) notFound()

  const snapshot = await loadDraftSnapshot(id)
  const finished = snapshot?.state.status === "complete"
  const report =
    snapshot && finished && capabilities.canManageDraft
      ? await loadDraftAnalytics(snapshot)
      : null
  const players = new Map((snapshot?.players ?? []).map((p) => [p.userId, p]))

  return (
    <main className="w-full space-y-6">
      <Breadcrumbs
        items={[
          { label: data.event.title, href: `/events/${id}` },
          { label: "Team draft", href: `/events/${id}/draft` },
          { label: "Recap", href: `/events/${id}/draft/recap` },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="osrs-heading text-2xl">Team draft recap</h2>
        {snapshot && finished && <ShareRecapImage eventId={id} />}
      </div>

      {snapshot && finished ? (
        <>
          <FinalRosters
            state={snapshot.state}
            players={players}
            viewerUserId={session.user.id}
          />
          <UnassignedList
            state={snapshot.state}
            lateJoiners={snapshot.lateJoiners}
            players={players}
            viewerUserId={session.user.id}
          />
          <PickHistoryTable
            state={snapshot.state}
            players={players}
            analysis={report?.analytics.picks}
          />
          {report && (
            <DraftAnalyticsPanel
              state={snapshot.state}
              players={players}
              analytics={report.analytics}
              optimum={report.optimum}
            />
          )}
        </>
      ) : (
        <div className="rounded-sm border border-dashed p-8 text-center">
          <p className="text-muted-foreground mb-4">
            {snapshot
              ? "The draft is not finished yet. The recap appears when the last pick is made."
              : "This event has no team draft."}
          </p>
          <Button asChild variant="outline">
            <Link href={`/events/${id}/draft`}>Back to the draft</Link>
          </Button>
        </div>
      )}
    </main>
  )
}
