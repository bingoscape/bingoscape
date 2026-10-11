export default function JoinClanLoading() {
  return (
    <main className="container mx-auto px-4 py-6 sm:py-8">
      <div
        role="status"
        aria-label="Loading invite"
        className="mx-auto max-w-lg motion-safe:animate-pulse"
      >
        <div className="h-64 rounded-sm bg-muted" />
      </div>
    </main>
  )
}
