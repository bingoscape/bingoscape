import { Skeleton } from "@/components/ui/skeleton"

/** Route-level skeleton: header, toolbar and a few table rows. */
export default function SuperAdminLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="mb-4 space-y-3" aria-hidden="true">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3" aria-hidden="true">
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="space-y-2 rounded-sm border p-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
