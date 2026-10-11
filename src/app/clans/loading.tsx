export default function ClansLoading() {
  return (
    <main className="container mx-auto px-4 py-6 sm:py-8">
      <div
        role="status"
        aria-label="Loading clans"
        className="space-y-5 motion-safe:animate-pulse"
      >
        <div className="h-12 w-48 rounded-sm bg-muted" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-40 rounded-sm bg-muted" />
          ))}
        </div>
      </div>
    </main>
  )
}
