import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { BowArrow, Crown, Ticket } from "lucide-react"

import { ClanActionsMenu } from "@/components/clan-actions-menu"
import ClanEventsPanel from "@/components/clan-events"
import { ClanInvitesManagement } from "@/components/clan-invites-management"
import { ClanMemberList, RoleBadge } from "@/components/clan-member-list"
import { FilterPills } from "@/components/filter-pills"
import { GenerateClanInviteLink } from "@/components/generate-clan-invite-link"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { canManageInvites } from "@/lib/clan"
import { getServerAuthSession } from "@/server/auth"
import {
  getClanEventRows,
  getClanInviteRows,
  getClanMemberRows,
  getClanOverview,
} from "@/server/queries/clans"

type ClanTab = "members" | "events" | "invites"

function parseTab(
  value: string | string[] | undefined,
  canInvite: boolean
): ClanTab {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === "events") return "events"
  if (raw === "invites" && canInvite) return "invites"
  return "members"
}

export default async function ClanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clanId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ clanId }, query, session] = await Promise.all([
    params,
    searchParams,
    getServerAuthSession(),
  ])
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/clans/${clanId}`)}`)
  }
  const userId = session.user.id

  const clan = await getClanOverview(clanId, userId)
  if (!clan) notFound()

  const canInvite = canManageInvites(clan.viewer.role)
  const tab = parseTab(query.tab, canInvite)
  const isOwner = clan.ownerId === userId
  const base = `/clans/${clan.id}`

  const [members, eventRows, invites] = await Promise.all([
    tab === "members" ? getClanMemberRows(clan.id) : null,
    tab === "events" ? getClanEventRows(clan.id, userId) : null,
    tab === "invites" ? getClanInviteRows(clan.id) : null,
  ])

  const ownerName = clan.owner?.runescapeName ?? clan.owner?.name ?? null

  return (
    <main id="main" className="container mx-auto px-4 py-6 sm:py-8">
      <div className="space-y-5">
        <PageHeader
          title={clan.name}
          icon={BowArrow}
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Clans", href: "/clans" },
            { label: clan.name },
          ]}
          meta={
            <>
              {ownerName && (
                <span className="inline-flex items-center gap-1">
                  <Crown aria-hidden="true" className="size-4 text-warning" />
                  <span className="sr-only">Owner: </span>
                  {ownerName}
                </span>
              )}
              <span>
                {clan.memberCount} {clan.memberCount === 1 ? "member" : "members"}
              </span>
              <span>
                {clan.eventCount} {clan.eventCount === 1 ? "event" : "events"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="sr-only">Your role:</span>
                <RoleBadge role={clan.viewer.role} />
              </span>
            </>
          }
          description={clan.description?.trim() || undefined}
          actions={
            <>
              {canInvite && (
                <Button asChild size="sm" className="w-full sm:w-auto">
                  <Link href={`${base}?tab=invites`}>
                    <Ticket aria-hidden="true" />
                    Invites
                  </Link>
                </Button>
              )}
              {!isOwner && (
                <ClanActionsMenu clanId={clan.id} clanName={clan.name} />
              )}
            </>
          }
        />

        <FilterPills
          label="Clan sections"
          pills={[
            {
              label: "Members",
              href: base,
              selected: tab === "members",
              count: clan.memberCount,
            },
            {
              label: "Events",
              href: `${base}?tab=events`,
              selected: tab === "events",
              count: clan.eventCount,
            },
            ...(canInvite
              ? [
                  {
                    label: "Invites",
                    href: `${base}?tab=invites`,
                    selected: tab === "invites",
                  },
                ]
              : []),
          ]}
        />

        {members && (
          <ClanMemberList
            clanId={clan.id}
            members={members}
            viewerId={userId}
            viewerRole={clan.viewer.role}
            ownerId={clan.ownerId}
          />
        )}

        {eventRows && <ClanEventsPanel rows={eventRows} clanName={clan.name} />}

        {invites && (
          <div className="space-y-5">
            <section
              aria-labelledby="create-invite-heading"
              className="osrs-panel space-y-4 rounded-sm p-3 sm:p-5"
            >
              <div>
                <h2
                  id="create-invite-heading"
                  className="osrs-heading text-lg font-bold"
                >
                  Create an invite link
                </h2>
                <p className="text-sm text-muted-foreground">
                  Invites are the only way into {clan.name}. Set an expiry or a
                  usage limit if you want the link to stop working on its own.
                </p>
              </div>
              <GenerateClanInviteLink clanId={clan.id} />
            </section>
            <section aria-labelledby="invites-heading" className="space-y-3">
              <h2 id="invites-heading" className="osrs-heading text-lg font-bold">
                Invite links{" "}
                <span className="text-base font-normal text-muted-foreground">
                  ({invites.length})
                </span>
              </h2>
              <ClanInvitesManagement invites={invites} />
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
