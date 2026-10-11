import { Skeleton } from "@/components/ui/skeleton"

const pulse = "animate-none motion-safe:animate-pulse"

export default function TemplateLoading() {
  return (
    <div
      role="status"
      aria-label="Loading template"
      className="container mx-auto space-y-6 px-4 py-6 sm:py-8"
    >
      <div className="space-y-3">
        <Skeleton className={`${pulse} h-4 w-56`} />
        <Skeleton className={`${pulse} h-9 w-80 max-w-full`} />
        <Skeleton className={`${pulse} h-4 w-64 max-w-full`} />
      </div>
      <Skeleton className={`${pulse} h-20 w-full`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className={`${pulse} aspect-square w-full max-w-xl`} />
        <Skeleton className={`${pulse} h-64 w-full`} />
      </div>
      <span className="sr-only">Loading template…</span>
    </div>
  )
}
