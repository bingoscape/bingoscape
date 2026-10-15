import type { Metadata } from "next"
import Link from "next/link"

import {
  AdminDataTable,
  type AdminColumn,
} from "@/components/super-admin/admin-data-table"
import { PageHeader } from "@/components/super-admin/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  buildListHref,
  parseListParams,
  toHrefState,
  type RawSearchParams,
} from "@/lib/admin-list-params"
import { parseAuditFilters } from "@/lib/super-admin-audit"
import { plural } from "@/lib/super-admin-format"
import {
  AUDIT_LIST_CONFIG,
  listAuditLog,
  type AuditRow,
} from "@/server/super-admin/queries"

export const metadata: Metadata = { title: "Audit log - Super admin" }

interface PageProps {
  searchParams: Promise<RawSearchParams>
}

const TARGET_PATH: Record<string, string> = {
  user: "/super-admin/users",
  clan: "/super-admin/clans",
  event: "/super-admin/events",
  image: "/super-admin/image-cache",
}

const OUTCOME_VARIANT = {
  success: "success",
  denied: "destructive",
  failed: "warning",
} as const

const timestamp = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
})

function hasValues(value: Record<string, unknown> | null) {
  return value !== null && Object.keys(value).length > 0
}

const columns: AdminColumn<AuditRow>[] = [
  {
    key: "time",
    header: "Time (UTC)",
    sortKey: "time",
    firstDir: "desc",
    isRowHeader: true,
    cell: (row) => (
      <time dateTime={row.createdAt.toISOString()} className="text-sm">
        {timestamp.format(row.createdAt)}
      </time>
    ),
  },
  {
    key: "action",
    header: "Action",
    cell: (row) => (
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-xs">{row.action}</code>
        <Badge
          variant={
            OUTCOME_VARIANT[row.outcome as keyof typeof OUTCOME_VARIANT] ??
            "outline"
          }
        >
          {row.outcome}
        </Badge>
      </div>
    ),
  },
  {
    key: "target",
    header: "Target",
    cell: (row) => {
      const base = TARGET_PATH[row.targetType]
      const label = row.targetLabel ?? row.targetId ?? "Unknown"
      // Deleted targets no longer have a page; images have no detail page, the
      // list is searched for the key; the bulk refresh targets the whole list.
      const linkable =
        base &&
        row.targetId &&
        !row.action.endsWith(".delete") &&
        !row.action.endsWith(".purge")
      const href =
        row.targetType === "image"
          ? row.action.startsWith("image.bulk.")
            ? base
            : `${base}?q=${encodeURIComponent(row.targetId ?? "")}`
          : `${base}/${row.targetId}`
      return (
        <div className="min-w-0 text-sm">
          <span className="text-muted-foreground text-xs">
            {row.targetType}{" "}
          </span>
          {linkable ? (
            <Link
              href={href ?? ""}
              className="underline-offset-4 hover:underline"
            >
              {label}
            </Link>
          ) : (
            <span>{label}</span>
          )}
        </div>
      )
    },
  },
  {
    key: "actor",
    header: "Actor",
    hideOnMobile: true,
    cell: (row) => (
      <span className="text-sm">{row.actorLabel ?? row.actorId ?? "-"}</span>
    ),
  },
  {
    key: "details",
    header: "Details",
    hideOnMobile: true,
    cell: (row) =>
      hasValues(row.before) || hasValues(row.after) || row.reason ? (
        <details className="text-xs">
          <summary className="cursor-pointer">Show</summary>
          {row.reason ? <p className="mt-1">{row.reason}</p> : null}
          {hasValues(row.before) ? (
            <pre className="bg-muted mt-1 max-w-sm overflow-x-auto rounded-sm p-2">
              before: {JSON.stringify(row.before, null, 1)}
            </pre>
          ) : null}
          {hasValues(row.after) ? (
            <pre className="bg-muted mt-1 max-w-sm overflow-x-auto rounded-sm p-2">
              after: {JSON.stringify(row.after, null, 1)}
            </pre>
          ) : null}
        </details>
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      ),
  },
]

export default async function SuperAdminAuditPage({
  searchParams,
}: PageProps) {
  const raw = await searchParams
  const params = parseListParams(raw, AUDIT_LIST_CONFIG)
  const filters = parseAuditFilters(raw)
  const data = await listAuditLog(params, filters)

  // Extra URL filters are carried through sort / search / pagination links.
  const state = {
    ...toHrefState(params, AUDIT_LIST_CONFIG),
    action: filters.action ?? undefined,
    actor: filters.actorId ?? undefined,
    targetType: filters.targetType ?? undefined,
    targetId: filters.targetId ?? undefined,
  }
  const hasExtraFilters = Boolean(
    filters.action || filters.actorId || filters.targetType || filters.targetId
  )

  return (
    <>
      <PageHeader
        title="Audit log"
        breadcrumbs={[{ label: "Audit log" }]}
        description="Every super-admin change, newest first. Emails are masked and secrets are never stored."
        meta={
          <span>
            {plural(data.totalCount, "entry", "entries")}
            {params.filter || params.q || hasExtraFilters
              ? " match"
              : " in total"}
          </span>
        }
        actions={
          hasExtraFilters ? (
            <Button asChild variant="secondary" size="sm">
              <Link
                href={buildListHref("/super-admin/audit", {
                  q: params.q,
                  filter: params.filter,
                })}
              >
                Clear target filters
              </Link>
            </Button>
          ) : undefined
        }
      />
      <AdminDataTable
        idPrefix="audit"
        caption="Audit log"
        noun="entries"
        columns={columns}
        rows={data.rows}
        getRowKey={(row) => row.id}
        basePath="/super-admin/audit"
        state={state}
        sort={{ key: params.sort, dir: params.dir }}
        page={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchLabel="Search audit log"
        searchPlaceholder="Search by action, target or actor"
        filters={[
          { label: "All", value: null },
          { label: "Success", value: "success" },
          { label: "Denied", value: "denied" },
          { label: "Failed", value: "failed" },
        ]}
        filterLabel="Filter by outcome"
      />
    </>
  )
}
