import EventList from "@/components/eventlist"
import TemplatePreviewWithTooltip from "@/components/template-preview-with-tooltip"
import getTemplateBoard from "@/lib/getTemplateBoard"
import { getServerAuthSession } from "@/server/auth"
import { getEvents } from "@/app/actions/events"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const session = await getServerAuthSession()
  const events = session ? await getEvents(session.user.id) : []

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8">
        {session ? (
          <div className="space-y-8">
            <EventList userId={session.user.id} initialEvents={events} />
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <div className="relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0" />
              <div className="relative py-16 text-center lg:py-24">
                <div className="mb-6 inline-block rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                  🎯 The Ultimate OSRS Bingo Platform
                </div>
                <h1 className="mb-6 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-6xl font-bold text-transparent lg:text-7xl">
                  BingoScape
                </h1>
                <p className="mx-auto mb-8 max-w-3xl text-xl leading-relaxed text-muted-foreground lg:text-2xl">
                  Create custom bingo boards, organize clan events, and compete
                  with friends. Track your progress in real-time with our
                  RuneLite plugin integration.
                </p>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link
                    href="/sign-in"
                    className="transform rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-lg transition-all duration-200 hover:scale-105 hover:bg-primary/90"
                  >
                    Get Started Free
                  </Link>
                  <a
                    href="https://runelite.net/plugin-hub/show/bingoscape-companion"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border-2 border-primary px-8 py-4 text-lg font-semibold text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground"
                  >
                    Download Plugin
                  </a>
                </div>
              </div>
            </div>

            {/* Bingo Preview */}
            <div className="p-8 lg:p-12">
              <div className="flex flex-col items-center gap-12 lg:flex-row">
                <div className="flex-1">
                  <h3 className="mb-4 text-2xl font-bold lg:text-3xl">
                    See BingoScape in Action
                  </h3>
                  <p className="mb-6 text-lg text-muted-foreground">
                    Experience dynamic bingo boards with custom goals, real-time
                    tracking, and seamless integration with your OSRS gameplay.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm">
                        Custom goal creation and management
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-sm">
                        Real-time progress tracking
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-purple-500" />
                      <span className="text-sm">Team collaboration tools</span>
                    </div>
                  </div>
                </div>
                <div className="max-w-xl flex-1">
                  <div className="rounded-lg bg-card p-4 shadow-lg">
                    <TemplatePreviewWithTooltip
                      templateData={getTemplateBoard()}
                      title="Live Bingo Board"
                      isDetailView={true}
                      fixedTooltipIndex={0}
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Features Section */}
            <div className="py-16 lg:py-24">
              <div className="mb-16 text-center">
                <h2 className="mb-4 text-3xl font-bold lg:text-4xl">
                  Everything You Need for OSRS Bingo
                </h2>
                <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                  Streamline your bingo competitions with powerful features
                  designed for Old School RuneScape players
                </p>
              </div>

              <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
                <div className="rounded-xl border bg-card p-8 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-6 w-fit rounded-full bg-red-500/10 p-4">
                    <span className="text-3xl">❤️</span>
                  </div>
                  <h3 className="mb-4 text-xl font-semibold">
                    Join Events & Track Progress
                  </h3>
                  <p className="text-muted-foreground">
                    Participate in clan events, track your bingo completion
                    progress, and compete with friends in real-time
                    competitions.
                  </p>
                </div>

                <div className="rounded-xl border bg-card p-8 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-6 w-fit rounded-full bg-blue-500/10 p-4">
                    <span className="text-3xl">📸</span>
                  </div>
                  <h3 className="mb-4 text-xl font-semibold">
                    Submit Evidence Instantly
                  </h3>
                  <p className="text-muted-foreground">
                    Upload screenshots directly through our RuneLite plugin
                    without interrupting your gameplay experience.
                  </p>
                </div>

                <div className="rounded-xl border bg-card p-8 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-6 w-fit rounded-full bg-green-500/10 p-4">
                    <span className="text-3xl">🤝</span>
                  </div>
                  <h3 className="mb-4 text-xl font-semibold">
                    Team Collaboration Made Easy
                  </h3>
                  <p className="text-muted-foreground">
                    Form teams, communicate with clan members, and coordinate
                    your bingo strategy for maximum efficiency.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
