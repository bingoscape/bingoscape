export default function ClanDetailLoading() {
  return (
    <main className="container mx-auto px-4 py-6 sm:py-8">
      <div
        role="status"
        aria-label="Loading clan"
        className="space-y-5 motion-safe:animate-pulse"
      >
        <div className="h-4 w-56 rounded-sm bg-muted" />
        <div className="h-12 w-72 rounded-sm bg-muted" />
        <div className="h-11 w-80 rounded-sm bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 rounded-sm bg-muted" />
          ))}
        </div>
      </div>
    </main>
  )
}
