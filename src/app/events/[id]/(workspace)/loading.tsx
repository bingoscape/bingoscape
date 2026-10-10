import { Skeleton } from "@/components/ui/skeleton"

/** Workspace skeleton: summary bar, board area and side panel. */
export default function EventWorkspaceLoading() {
  return (
    <div className="flex flex-col gap-3 px-3 pb-3 sm:px-4 lg:h-[calc(100dvh-var(--nav-h)-var(--nav-gap))] lg:overflow-hidden">
      <Skeleton className="h-11 w-full" />
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(360px,30vw,480px)]">
        <div className="flex min-h-0 flex-col gap-2">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="min-h-64 flex-1" />
        </div>
        <Skeleton className="hidden min-h-0 lg:block" />
      </div>
    </div>
  )
}
