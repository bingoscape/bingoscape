import { Skeleton } from "@/components/ui/skeleton"

const pulse = "animate-none motion-safe:animate-pulse"

export default function MyTemplatesLoading() {
  return (
    <div
      role="status"
      aria-label="Loading your templates"
      className="container mx-auto space-y-6 px-4 py-6 sm:py-8"
    >
      <div className="space-y-3">
        <Skeleton className={`${pulse} h-4 w-48`} />
        <Skeleton className={`${pulse} h-9 w-56`} />
      </div>
      <div className="flex gap-2">
        <Skeleton className={`${pulse} h-11 w-20`} />
        <Skeleton className={`${pulse} h-11 w-24`} />
        <Skeleton className={`${pulse} h-11 w-24`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className={`${pulse} h-96 w-full`} />
        ))}
      </div>
      <span className="sr-only">Loading your templates…</span>
    </div>
  )
}
