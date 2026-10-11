import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Calendar, ImageIcon, Shield, Users } from "lucide-react"

import {
  ClanMembershipRows,
  EmptyNote,
  EventRows,
  ListFootnote,
  ListSection,
  ViewAllLink,
} from "@/components/super-admin/entity-lists"
import { CopyIdButton } from "@/components/super-admin/copy-id-button"
import {
  DetailTabs,
  resolveTab,
  type DetailTab,
} from "@/components/super-admin/detail-tabs"
import { PageHeader } from "@/components/super-admin/page-header"
import { Stat } from "@/components/super-admin/stat"
import { UserActions } from "@/components/super-admin/user-actions"
import { UserAvatar } from "@/components/super-admin/user-avatar"
import { ClanLink } from "@/components/super-admin/admin-links"
import { Badge } from "@/components/ui/badge"
import { userLabel } from "@/lib/super-admin-format"
import { getUserDetail } from "@/server/super-admin/queries"

interface PageProps {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}

export const metadata: Metadata = { title: "User - Super admin" }

export default async function UserDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { userId } = await params
  const detail = await getUserDetail(userId)
  if (!detail) notFound()

  const { user, totals } = detail
  const label = userLabel(user)
  const basePath = `/super-admin/users/${user.id}`

  const tabs: DetailTab[] = [
    { key: "overview", label: "Overview" },
    { key: "clans", label: "Clans", count: totals.clans },
    {
      key: "events",
      label: "Events",
      count: totals.createdEvents + totals.participations,
    },
  ]
  const active = resolveTab((await searchParams).tab, tabs)
  const participationRoles = new Map(
    detail.participations.map((p) => [p.id, p.role])
  )

  return (
    <>
      <PageHeader
        title={label}
        breadcrumbs={[
          { label: "Users", href: "/super-admin/users" },
          { label },
        ]}
        leading={
          <UserAvatar label={label} image={user.image} className="h-12 w-12" />
        }
        meta={
          <>
            {user.email ? <span>{user.email}</span> : null}
            {user.runescapeName ? <span>RSN: {user.runescapeName}</span> : null}
            {!user.emailVerified ? (
              <Badge variant="outline">Unverified</Badge>
            ) : null}
            <CopyIdButton id={user.id} noun="user" />
          </>
        }
        actions={
          <UserActions
            variant="buttons"
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              runescapeName: user.runescapeName,
            }}
            redirectAfterDelete="/super-admin/users"
            counts={{
              createdEvents: totals.createdEvents,
              ownedClans: totals.ownedClans,
              clanMemberships: totals.clans,
              eventParticipations: totals.participations,
              submissions: totals.submissions,
              othersInCreatedEvents: totals.othersInCreatedEvents,
            }}
          />
        }
      />

      <DetailTabs basePath={basePath} tabs={tabs} active={active} />

      {active === "overview" ? (
        <div className="space-y-6">
          <h2 className="sr-only">Overview</h2>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <li>
              <Stat label="Clans" value={totals.clans} icon={Shield} />
            </li>
            <li>
              <Stat
                label="Events created"
                value={totals.createdEvents}
                icon={Calendar}
              />
            </li>
            <li>
              <Stat
                label="Participating in"
                value={totals.participations}
                icon={Users}
              />
            </li>
            <li>
              <Stat
                label="Submissions"
                value={totals.submissions}
                icon={ImageIcon}
              />
            </li>
          </ul>

          <div className="grid gap-6 lg:grid-cols-2">
            <ListSection
              title="Clans"
              count={totals.clans}
              action={
                totals.clans > 5 ? (
                  <ViewAllLink
                    href={`${basePath}?tab=clans`}
                    total={totals.clans}
                  />
                ) : null
              }
            >
              {detail.clans.length === 0 ? (
                <EmptyNote>Not a member of any clan.</EmptyNote>
              ) : (
                <ClanMembershipRows memberships={detail.clans.slice(0, 5)} />
              )}
            </ListSection>

            <ListSection
              title="Created events"
              count={totals.createdEvents}
              action={
                totals.createdEvents > 5 ? (
                  <ViewAllLink
                    href={`${basePath}?tab=events`}
                    total={totals.createdEvents}
                  />
                ) : null
              }
            >
              {detail.createdEvents.length === 0 ? (
                <EmptyNote>No events created.</EmptyNote>
              ) : (
                <EventRows events={detail.createdEvents.slice(0, 5)} />
              )}
            </ListSection>
          </div>
        </div>
      ) : null}

      {active === "clans" ? (
        <div className="space-y-6">
          <ListSection title="Memberships" count={totals.clans}>
            {detail.clans.length === 0 ? (
              <EmptyNote>Not a member of any clan.</EmptyNote>
            ) : (
              <ClanMembershipRows memberships={detail.clans} />
            )}
            <ListFootnote shown={detail.clans.length} total={totals.clans} />
          </ListSection>
          {detail.ownedClans.length > 0 ? (
            <ListSection title="Owned clans" count={totals.ownedClans}>
              <ul className="flex flex-wrap gap-2">
                {detail.ownedClans.map((clan) => (
                  <li key={clan.id}>
                    <Badge variant="outline" className="px-3 py-1 text-sm">
                      <ClanLink clan={clan} />
                    </Badge>
                  </li>
                ))}
              </ul>
            </ListSection>
          ) : null}
        </div>
      ) : null}

      {active === "events" ? (
        <div className="space-y-6">
          <ListSection title="Created events" count={totals.createdEvents}>
            {detail.createdEvents.length === 0 ? (
              <EmptyNote>No events created.</EmptyNote>
            ) : (
              <EventRows events={detail.createdEvents} />
            )}
            <ListFootnote
              shown={detail.createdEvents.length}
              total={totals.createdEvents}
            />
          </ListSection>
          <ListSection title="Participating in" count={totals.participations}>
            {detail.participations.length === 0 ? (
              <EmptyNote>Not participating in any events.</EmptyNote>
            ) : (
              <EventRows
                events={detail.participations}
                roleOf={(id) => participationRoles.get(id)}
              />
            )}
            <ListFootnote
              shown={detail.participations.length}
              total={totals.participations}
            />
          </ListSection>
        </div>
      ) : null}
    </>
  )
}
