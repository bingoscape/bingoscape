import type { Metadata } from "next"
import Link from "next/link"

import {
  AdminDataTable,
  type AdminColumn,
} from "@/components/super-admin/admin-data-table"
import { PageHeader } from "@/components/super-admin/page-header"
import { UserActions } from "@/components/super-admin/user-actions"
import { UserAvatar } from "@/components/super-admin/user-avatar"
import { Badge } from "@/components/ui/badge"
import {
  parseListParams,
  toHrefState,
  type RawSearchParams,
} from "@/lib/admin-list-params"
import { plural, userLabel } from "@/lib/super-admin-format"
import {
  listUsers,
  USER_LIST_CONFIG,
  type UserListRow,
} from "@/server/super-admin/queries"

export const metadata: Metadata = { title: "Users - Super admin" }

interface PageProps {
  searchParams: Promise<RawSearchParams>
}

const columns: AdminColumn<UserListRow>[] = [
  {
    key: "name",
    header: "User",
    sortKey: "name",
    isRowHeader: true,
    cell: (user) => {
      const label = userLabel(user)
      return (
        <div className="flex items-center gap-3">
          <UserAvatar label={label} image={user.image} />
          <div className="min-w-0">
            <Link
              href={`/super-admin/users/${user.id}`}
              className="focus-visible:ring-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
            >
              {label}
            </Link>
            {!user.emailVerified ? (
              <Badge variant="outline" className="ml-2">
                Unverified
              </Badge>
            ) : null}
            {user.email ? (
              <div className="text-muted-foreground truncate text-xs md:hidden">
                {user.email}
              </div>
            ) : null}
          </div>
        </div>
      )
    },
  },
  {
    key: "email",
    header: "Email",
    sortKey: "email",
    hideOnMobile: true,
    cell: (user) =>
      user.email ?? <span className="text-muted-foreground">None</span>,
  },
  {
    key: "rsn",
    header: "RuneScape name",
    sortKey: "rsn",
    hideOnMobile: true,
    cell: (user) =>
      user.runescapeName ?? (
        <span className="text-muted-foreground">Not set</span>
      ),
  },
  {
    key: "clans",
    header: "Clans",
    hideOnMobile: true,
    cell: (user) => user.clanMemberships,
  },
  {
    key: "created",
    header: "Events created",
    hideOnMobile: true,
    cell: (user) => user.createdEvents,
  },
]

export default async function SuperAdminUsersPage({ searchParams }: PageProps) {
  const params = parseListParams(await searchParams, USER_LIST_CONFIG)
  const data = await listUsers(params)

  return (
    <>
      <PageHeader
        title="Users"
        breadcrumbs={[{ label: "Users" }]}
        meta={<span>{plural(data.totalCount, "user")} in total</span>}
      />
      <AdminDataTable
        idPrefix="users"
        caption="Users"
        noun="users"
        columns={columns}
        rows={data.rows}
        getRowKey={(user) => user.id}
        rowActions={(user) => (
          <UserActions
            variant="menu"
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              runescapeName: user.runescapeName,
            }}
            counts={{
              createdEvents: user.createdEvents,
              ownedClans: user.ownedClans,
              clanMemberships: user.clanMemberships,
              eventParticipations: user.eventParticipations,
            }}
          />
        )}
        basePath="/super-admin/users"
        state={toHrefState(params, USER_LIST_CONFIG)}
        sort={{ key: params.sort, dir: params.dir }}
        page={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchLabel="Search users"
        searchPlaceholder="Search by name, email or RuneScape name"
      />
    </>
  )
}
