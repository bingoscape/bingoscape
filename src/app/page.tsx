import EventList from "@/components/eventlist"
import TemplatePreviewWithTooltip from "@/components/template-preview-with-tooltip"
import getTemplateBoard from "@/lib/getTemplateBoard"
import { getServerAuthSession } from "@/server/auth"
import Link from "next/link"

export default async function HomePage() {
  const session = await getServerAuthSession()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8">
        {session ? (
          <div className="space-y-8">
            <EventList userId={session.user.id} />
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none" />
              <div className="text-center py-16 lg:py-24 relative">
                <div className="inline-block px-4 py-2 bg-primary/10 rounded-full text-primary font-medium text-sm mb-6">
                  🎯 The Ultimate OSRS Bingo Platform
                </div>
                <h1 className="text-6xl lg:text-7xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent mb-6">
                  BingoScape
                </h1>
                <p className="text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
                  Create custom bingo boards, organize clan events, and compete with friends. Track your progress in real-time with our RuneLite plugin integration.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Link
                    href="/sign-in"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    Get Started Free
                  </Link>
                  <a
                    href="https://runelite.net/plugin-hub/show/bingoscape-companion"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200"
                  >
                    Download Plugin
                  </a>
                </div>
              </div>
            </div>

            {/* Bingo Preview */}
            <div className="p-8 lg:p-12">
              <div className="flex flex-col lg:flex-row gap-12 items-center">
                <div className="flex-1">
                  <h3 className="text-2xl lg:text-3xl font-bold mb-4">See BingoScape in Action</h3>
                  <p className="text-lg text-muted-foreground mb-6">
                    Experience dynamic bingo boards with custom goals, real-time tracking, and seamless integration with your OSRS gameplay.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm">Custom goal creation and management</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-sm">Real-time progress tracking</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full" />
                      <span className="text-sm">Team collaboration tools</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 max-w-xl">
                  <div className="bg-card rounded-lg p-4 shadow-lg">
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
              <div className="text-center mb-16">
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">Everything You Need for OSRS Bingo</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Streamline your bingo competitions with powerful features designed for Old School RuneScape players
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                <div className="bg-card p-8 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <div className="bg-red-500/10 p-4 rounded-full w-fit mb-6">
                    <span className="text-3xl">❤️</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-4">Join Events & Track Progress</h3>
                  <p className="text-muted-foreground">
                    Participate in clan events, track your bingo completion progress, and compete with friends in real-time competitions.
                  </p>
                </div>

                <div className="bg-card p-8 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <div className="bg-blue-500/10 p-4 rounded-full w-fit mb-6">
                    <span className="text-3xl">📸</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-4">Submit Evidence Instantly</h3>
                  <p className="text-muted-foreground">
                    Upload screenshots directly through our RuneLite plugin without interrupting your gameplay experience.
                  </p>
                </div>

                <div className="bg-card p-8 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <div className="bg-green-500/10 p-4 rounded-full w-fit mb-6">
                    <span className="text-3xl">🤝</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-4">Team Collaboration Made Easy</h3>
                  <p className="text-muted-foreground">
                    Form teams, communicate with clan members, and coordinate your bingo strategy for maximum efficiency.
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

