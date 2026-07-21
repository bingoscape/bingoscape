import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AdminLoading() {
  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header & Navigation Skeleton */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled
              className="text-muted-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Event
            </Button>
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-300 dark:text-slate-800">
            <ShieldCheck className="h-8 w-8" />
            <Skeleton className="h-8 w-48" />
          </h1>
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Main Content Area Skeleton */}
      <main className="space-y-6 rounded-3xl border bg-linear-to-br from-slate-50 to-slate-100 p-6 shadow-inner dark:from-slate-900/50 dark:to-slate-900 md:p-8">
        {/* Quick Stats Row */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border bg-white/10 p-6 shadow-xs backdrop-blur-md dark:bg-black/10"
            >
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </section>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 gap-6 pt-4 lg:grid-cols-3">
          {/* Left: Actions */}
          <section className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border bg-white/50 p-6 backdrop-blur-xs dark:bg-black/20">
              <Skeleton className="mb-6 h-6 w-32" />
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </section>

          {/* Right: Insights */}
          <section className="space-y-6">
            <div className="h-full rounded-2xl border bg-white/50 p-6 backdrop-blur-xs dark:bg-black/20">
              <Skeleton className="mb-6 h-6 w-40" />

              <div className="space-y-6">
                <div>
                  <Skeleton className="mb-2 h-4 w-32" />
                  <Skeleton className="h-8 w-16" />
                </div>

                <div className="space-y-3 border-t pt-6">
                  <Skeleton className="mb-4 h-4 w-24" />
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
