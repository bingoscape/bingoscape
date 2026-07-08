import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function EventLoading() {
  return (
    <div className="container mx-auto py-6">
      {/* Breadcrumb skeleton */}
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Header Card skeleton */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="mt-4 flex flex-col gap-2 pl-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content skeleton */}
      <main className="w-full space-y-12">
        <section>
          <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </section>

        <section>
          <div className="mb-6 space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
