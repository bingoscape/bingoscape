import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLoading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header & Navigation Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" disabled className="text-muted-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Event
            </Button>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-300 dark:text-slate-800">
            <ShieldCheck className="h-8 w-8" />
            <Skeleton className="h-8 w-48" />
          </h1>
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Main Content Area Skeleton */}
      <main className="space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-900 rounded-3xl p-6 md:p-8 border shadow-inner">
        
        {/* Quick Stats Row */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-6 rounded-2xl border bg-white/10 dark:bg-black/10 backdrop-blur-md shadow-sm flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </section>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          
          {/* Left: Actions */}
          <section className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl border bg-white/50 dark:bg-black/20 backdrop-blur-sm">
              <Skeleton className="h-6 w-32 mb-6" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </section>

          {/* Right: Insights */}
          <section className="space-y-6">
            <div className="p-6 rounded-2xl border bg-white/50 dark:bg-black/20 backdrop-blur-sm h-full">
              <Skeleton className="h-6 w-40 mb-6" />
              
              <div className="space-y-6">
                <div>
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </div>
                
                <div className="border-t pt-6 space-y-3">
                  <Skeleton className="h-4 w-24 mb-4" />
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
  );
}
