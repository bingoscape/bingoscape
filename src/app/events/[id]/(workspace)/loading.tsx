import { cookies } from "next/headers"
import { Skeleton } from "@/components/ui/skeleton"
import {
  WORKSPACE_PREFS_COOKIE,
  parseWorkspacePrefs,
  sideWidthCss,
} from "@/lib/workspace-prefs"

/** Workspace skeleton: summary bar, board area and side panel. */
export default async function EventWorkspaceLoading() {
  const cookieStore = await cookies()
  const prefs = parseWorkspacePrefs(
    cookieStore.get(WORKSPACE_PREFS_COOKIE)?.value
  )

  return (
    <div className="flex flex-col gap-3 px-3 pb-3 sm:px-4 lg:h-[calc(100dvh-var(--nav-h)-var(--nav-gap))] lg:overflow-hidden">
      <Skeleton className="h-11 w-full" />
      <div
        style={{ "--side-w": sideWidthCss(prefs) } as React.CSSProperties}
        className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_0.75rem_var(--side-w)] lg:gap-0"
      >
        <div className="flex min-h-0 flex-col gap-2">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="min-h-64 flex-1" />
        </div>
        <div className="hidden lg:block" aria-hidden="true" />
        <Skeleton className="hidden min-h-0 lg:block" />
      </div>
    </div>
  )
}
