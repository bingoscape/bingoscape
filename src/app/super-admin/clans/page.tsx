import type { Metadata } from "next"

import { ClanActions } from "@/components/super-admin/clan-actions"
import { ClanLink, UserLink } from "@/components/super-admin/admin-links"
import {
  AdminDataTable,
  type AdminColumn,
} from "@/components/super-admin/admin-data-table"
import { PageHeader } from "@/components/super-admin/page-header"
import { Badge } from "@/components/ui/badge"
import {
  parseListParams,
  toHrefState,
  type RawSearchParams,
} from "@/lib/admin-list-params"
import { formatDate, plural } from "@/lib/super-admin-format"
import {
  CLAN_LIST_CONFIG,
  listClans,
  type ClanListRow,
} from "@/server/super-admin/queries"

export const metadata: Metadata = { title: "Clans - Super admin" }

interface PageProps {
  searchParams: Promise<RawSearchParams>
}

const columns: AdminColumn<ClanListRow>[] = [
  {
    key: "name",
    header: "Clan",
    sortKey: "name",
    isRowHeader: true,
    cell: (clan) => (
      <div className="min-w-0">
        <ClanLink clan={clan} />
        <div className="text-muted-foreground truncate text-xs md:hidden">
          {clan.owner ? "Owner: " : "No owner"}
          {clan.owner
            ? (clan.owner.name ?? clan.owner.runescapeName ?? "Unnamed")
            : ""}
        </div>
        {clan.description ? (
          <div className="text-muted-foreground line-clamp-1 hidden max-w-md text-xs md:block">
            {clan.description}
          </div>
        ) : null}
      </div>
    ),
  },
  {
    key: "owner",
    header: "Owner",
    hideOnMobile: true,
    cell: (clan) =>
      clan.owner ? (
        <UserLink user={clan.owner} />
      ) : (
        <Badge variant="warning">No owner</Badge>
      ),
  },
  {
    key: "members",
    header: "Members",
    sortKey: "members",
    firstDir: "desc",
    cell: (clan) => clan.memberCount,
  },
  {
    key: "events",
    header: "Events",
    sortKey: "events",
    firstDir: "desc",
    cell: (clan) => clan.eventCount,
  },
  {
    key: "created",
    header: "Created",
    sortKey: "created",
    firstDir: "desc",
    hideOnMobile: true,
    cell: (clan) => formatDate(clan.createdAt),
  },
]

export default async function SuperAdminClansPage({ searchParams }: PageProps) {
  const params = parseListParams(await searchParams, CLAN_LIST_CONFIG)
  const data = await listClans(params)

  return (
    <>
      <PageHeader
        title="Clans"
        breadcrumbs={[{ label: "Clans" }]}
        meta={
          <span>
            {plural(data.totalCount, "clan")}
            {params.filter || params.q ? " match" : " in total"}
          </span>
        }
      />
      <AdminDataTable
        idPrefix="clans"
        caption="Clans"
        noun="clans"
        columns={columns}
        rows={data.rows}
        getRowKey={(clan) => clan.id}
        rowActions={(clan) => (
          <ClanActions
            variant="menu"
            clan={{
              id: clan.id,
              name: clan.name,
              description: clan.description,
              ownerId: clan.owner?.id ?? null,
            }}
            counts={{ members: clan.memberCount, events: clan.eventCount }}
          />
        )}
        basePath="/super-admin/clans"
        state={toHrefState(params, CLAN_LIST_CONFIG)}
        sort={{ key: params.sort, dir: params.dir }}
        page={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchLabel="Search clans"
        searchPlaceholder="Search by name or description"
        filters={[
          { label: "All", value: null },
          { label: "No owner", value: "no-owner" },
        ]}
      />
    </>
  )
}
