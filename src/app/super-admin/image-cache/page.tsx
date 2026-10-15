import type { Metadata } from "next"
import Image from "next/image"
import { Images } from "lucide-react"

import { ImageCacheBulkControls } from "@/components/super-admin/image-cache-bulk-controls"
import { ImageCacheRowActions } from "@/components/super-admin/image-cache-row-actions"
import {
  AdminDataTable,
  type AdminColumn,
} from "@/components/super-admin/admin-data-table"
import { PageHeader } from "@/components/super-admin/page-header"
import { Stat } from "@/components/super-admin/stat"
import { Badge } from "@/components/ui/badge"
import {
  parseListParams,
  toHrefState,
  type RawSearchParams,
} from "@/lib/admin-list-params"
import { keyToProxyUrl } from "@/lib/osrs-image"
import { formatBytes, formatDateTime, plural } from "@/lib/super-admin-format"
import { getBulkRefresher } from "@/server/osrs-image/bulk-refresh"
import {
  IMAGE_CACHE_LIST_CONFIG,
  getImageCacheSummary,
  listImageCache,
  type ImageCacheRow,
} from "@/server/super-admin/queries"

export const metadata: Metadata = { title: "Image cache - Super admin" }

interface PageProps {
  searchParams: Promise<RawSearchParams>
}

const STATUS_VARIANT = {
  ok: "success",
  not_found: "warning",
  error: "destructive",
} as const

const columns: AdminColumn<ImageCacheRow>[] = [
  {
    key: "preview",
    header: "Preview",
    cell: (row) =>
      row.status === "ok" ? (
        // Served from the cache (a hit, no wiki request); the version query
        // makes a refreshed image show up here without a hard reload.
        <Image
          src={`${keyToProxyUrl(row.key)}?v=${row.fetchedAt?.getTime() ?? 0}`}
          alt=""
          width={40}
          height={40}
          unoptimized
          className="h-10 w-10 object-contain"
        />
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      ),
  },
  {
    key: "key",
    header: "Key",
    sortKey: "key",
    isRowHeader: true,
    cell: (row) => (
      <code className="block max-w-xs text-xs break-all md:max-w-md">
        {row.key}
      </code>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortKey: "status",
    cell: (row) => (
      <Badge variant={STATUS_VARIANT[row.status]}>
        {row.status === "ok"
          ? row.refreshedAt
            ? "ok"
            : "ok, stale"
          : row.status}
      </Badge>
    ),
  },
  {
    key: "size",
    header: "Size",
    sortKey: "size",
    firstDir: "desc",
    hideOnMobile: true,
    cell: (row) => (row.bytes === null ? "-" : formatBytes(row.bytes)),
  },
  {
    key: "fetched",
    header: "Fetched (UTC)",
    sortKey: "fetched",
    firstDir: "desc",
    hideOnMobile: true,
    cell: (row) => (row.fetchedAt ? formatDateTime(row.fetchedAt) : "-"),
  },
  {
    key: "refreshed",
    header: "Refreshed (UTC)",
    sortKey: "refreshed",
    firstDir: "desc",
    hideOnMobile: true,
    cell: (row) => (row.refreshedAt ? formatDateTime(row.refreshedAt) : "-"),
  },
  {
    key: "attempts",
    header: "Attempts",
    sortKey: "attempts",
    firstDir: "desc",
    hideOnMobile: true,
    cell: (row) => row.attempts,
  },
  {
    key: "retry",
    header: "Retry after (UTC)",
    sortKey: "retry",
    firstDir: "desc",
    hideOnMobile: true,
    cell: (row) => (row.retryAfter ? formatDateTime(row.retryAfter) : "-"),
  },
]

export default async function SuperAdminImageCachePage({
  searchParams,
}: PageProps) {
  const params = parseListParams(await searchParams, IMAGE_CACHE_LIST_CONFIG)
  const [data, summary] = await Promise.all([
    listImageCache(params),
    getImageCacheSummary(),
  ])
  const progress = getBulkRefresher().progress()
  const failed = progress.outcomes.not_found + progress.outcomes.error

  return (
    <>
      <PageHeader
        title="Wiki image cache"
        breadcrumbs={[{ label: "Image cache" }]}
        description="OSRS Wiki images served from our own cache. Refreshing asks the wiki whether an image changed (an unchanged image costs a 304 and keeps the file); purging forgets an image so the next request fetches it again. Browsers keep a served image for up to one day (max-age=86400), so a changed image can take that long to show for viewers, or a hard reload."
        meta={
          <span>
            {plural(data.totalCount, "entry", "entries")}
            {params.filter || params.q ? " match" : " in total"}
          </span>
        }
        actions={
          <ImageCacheBulkControls
            running={progress.running}
            stale={summary.stale}
            cached={summary.ok}
          />
        }
      />

      <section
        aria-label="Cache summary"
        className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Stat label="Cached images" value={summary.ok} icon={Images}>
          <span>{formatBytes(summary.totalBytes)}</span>
        </Stat>
        <Stat
          label="Waiting for refresh"
          value={summary.stale}
          href="/super-admin/image-cache?filter=stale"
        />
        <Stat
          label="Not found"
          value={summary.notFound}
          href="/super-admin/image-cache?filter=not_found"
        />
        <Stat
          label="Errors"
          value={summary.error}
          href="/super-admin/image-cache?filter=error"
        />
      </section>

      <div
        role="status"
        aria-live="polite"
        className="osrs-panel-inset mb-4 rounded-sm px-4 py-3 text-sm"
      >
        {progress.running ? (
          <p>
            Bulk refresh running: {plural(progress.processed, "image")}{" "}
            processed this run ({progress.outcomes.not_modified} unchanged,{" "}
            {progress.outcomes.replaced} replaced, {failed} failed),{" "}
            {summary.stale.toLocaleString("en-GB")} still waiting. About one
            request per second.
          </p>
        ) : progress.startedAt ? (
          <p>
            Last bulk refresh in this server process:{" "}
            {plural(progress.processed, "image")} processed (
            {progress.outcomes.not_modified} unchanged,{" "}
            {progress.outcomes.replaced} replaced, {failed} failed).{" "}
            {summary.stale > 0
              ? `${summary.stale.toLocaleString("en-GB")} images are still waiting; Resume continues with them.`
              : "Nothing is waiting."}
          </p>
        ) : summary.stale > 0 ? (
          <p>
            No bulk refresh is running, but{" "}
            {summary.stale.toLocaleString("en-GB")} images are marked as waiting
            (for example after a restart). Resume continues with them.
          </p>
        ) : (
          <p>No bulk refresh is running.</p>
        )}
      </div>

      <AdminDataTable
        idPrefix="image-cache"
        caption="Cached wiki images"
        noun="images"
        columns={columns}
        rows={data.rows}
        getRowKey={(row) => row.key}
        rowActions={(row) => (
          <ImageCacheRowActions imageKey={row.key} status={row.status} />
        )}
        basePath="/super-admin/image-cache"
        state={toHrefState(params, IMAGE_CACHE_LIST_CONFIG)}
        sort={{ key: params.sort, dir: params.dir }}
        page={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchLabel="Search images"
        searchPlaceholder="Search by key"
        filters={[
          { label: "All", value: null },
          { label: "OK", value: "ok" },
          { label: "Waiting", value: "stale" },
          { label: "Not found", value: "not_found" },
          { label: "Error", value: "error" },
        ]}
        filterLabel="Filter by status"
        emptyTitle="No cached images yet"
      />
    </>
  )
}
