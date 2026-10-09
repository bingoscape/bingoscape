import EventList from "@/components/eventlist"
import TemplatePreviewWithTooltip from "@/components/template-preview-with-tooltip"
import getTemplateBoard from "@/lib/getTemplateBoard"
import { getServerAuthSession } from "@/server/auth"
import { cn } from "@/lib/utils"

import Link from "next/link"
import {
  Axe,
  Camera,
  Check,
  Clock,
  Crown,
  Download,
  Fish,
  Flame,
  Gem,
  type LucideIcon,
  Pickaxe,
  Shield,
  Skull,
  Sword,
  Trophy,
  Users,
} from "lucide-react"

import { Suspense } from "react"
import { getEvents } from "@/server/queries/events"

async function LoggedInDashboard({ userId }: { userId: string }) {
  const events = await getEvents(userId)

  return (
    <div className="space-y-8">
      <EventList userId={userId} initialEvents={events} />
    </div>
  )
}

type PreviewTileState = "completed" | "pending" | "empty"

interface PreviewTile {
  icon: LucideIcon
  xp: number
  state: PreviewTileState
}

// Static, decorative example Board (4x4). No real data.
const PREVIEW_TILES: PreviewTile[] = [
  { icon: Sword, xp: 10, state: "completed" },
  { icon: Skull, xp: 25, state: "pending" },
  { icon: Gem, xp: 15, state: "empty" },
  { icon: Crown, xp: 50, state: "empty" },
  { icon: Fish, xp: 5, state: "completed" },
  { icon: Flame, xp: 20, state: "completed" },
  { icon: Pickaxe, xp: 10, state: "empty" },
  { icon: Shield, xp: 30, state: "pending" },
  { icon: Axe, xp: 5, state: "empty" },
  { icon: Gem, xp: 40, state: "empty" },
  { icon: Sword, xp: 15, state: "completed" },
  { icon: Skull, xp: 35, state: "empty" },
  { icon: Crown, xp: 60, state: "empty" },
  { icon: Fish, xp: 10, state: "pending" },
  { icon: Flame, xp: 25, state: "empty" },
  { icon: Pickaxe, xp: 20, state: "completed" },
]

function BoardPreview() {
  return (
    <div
      role="img"
      aria-label="Example Board preview with completed, pending and empty Tiles"
      className="mx-auto w-full max-w-md border border-black bg-osrs-stone-700 p-3 shadow-[inset_2px_2px_0_0_#6d6350,inset_-2px_-2px_0_0_#1c170f,4px_4px_0_0_rgb(0_0_0/0.7)]"
    >
      <div
        aria-hidden="true"
        className="mb-3 flex items-center justify-between border border-black bg-osrs-stone-950 px-3 py-1.5 shadow-[inset_2px_2px_0_0_#17120b,inset_-1px_-1px_0_0_#4b4132]"
      >
        <span className="font-display text-sm text-osrs-gold osrs-text-shadow">
          Example Board
        </span>
        <span className="font-display text-sm text-osrs-yellow osrs-text-shadow">
          5 / 16
        </span>
      </div>
      <div aria-hidden="true" className="grid grid-cols-4 gap-1.5">
        {PREVIEW_TILES.map((tile, index) => {
          const Icon = tile.icon
          return (
            <div
              key={index}
              className={cn(
                "relative flex aspect-square items-center justify-center border border-black bg-osrs-stone-950 shadow-[inset_2px_2px_0_0_#17120b,inset_-1px_-1px_0_0_#4b4132]",
                tile.state === "completed" && "bg-osrs-stone-900"
              )}
            >
              <Icon
                className={cn(
                  "h-1/2 w-1/2",
                  tile.state === "empty"
                    ? "text-osrs-stone-500"
                    : "text-osrs-parchment"
                )}
              />
              <span className="osrs-qty absolute left-1 top-0.5 text-xs">
                {tile.xp}
              </span>
              {tile.state === "completed" && (
                <>
                  <span className="absolute inset-0 bg-osrs-green/10" />
                  <Check
                    strokeWidth={4}
                    className="absolute bottom-0.5 right-0.5 h-4 w-4 text-osrs-green drop-shadow-[1px_1px_0_#000]"
                  />
                </>
              )}
              {tile.state === "pending" && (
                <Clock
                  strokeWidth={3}
                  className="absolute bottom-0.5 right-0.5 h-4 w-4 text-osrs-cyan drop-shadow-[1px_1px_0_#000]"
                />
              )}
            </div>
          )
        })}
      </div>
      <div
        aria-hidden="true"
        className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-osrs-parchment"
      >
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3 text-osrs-green" strokeWidth={4} />
          Completed
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-osrs-cyan" strokeWidth={3} />
          Awaiting review
        </span>
      </div>
    </div>
  )
}

const stoneButton =
  "osrs-btn inline-flex items-center justify-center gap-2 rounded-sm px-8 py-3 text-lg font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-osrs-yellow"

export default async function HomePage() {
  const session = await getServerAuthSession()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8">
        {session ? (
          <Suspense
            fallback={
              <div
                role="status"
                aria-label="Loading"
                className="flex h-64 items-center justify-center"
              >
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
              </div>
            }
          >
            <LoggedInDashboard userId={session.user.id} />
          </Suspense>
        ) : (
          <>
            {/* Hero Section */}
            <section className="osrs-texture border border-black bg-osrs-stone-900 text-osrs-parchment shadow-[inset_2px_2px_0_0_#6d6350,inset_-2px_-2px_0_0_#1c170f,4px_4px_0_0_rgb(0_0_0/0.7)]">
              <div className="grid items-center gap-10 px-6 py-12 lg:grid-cols-2 lg:gap-12 lg:px-12 lg:py-20">
                <div className="text-center lg:text-left">
                  <p className="mb-4 inline-block border border-black bg-osrs-stone-950 px-3 py-1 text-sm font-medium text-osrs-parchment shadow-[inset_2px_2px_0_0_#17120b,inset_-1px_-1px_0_0_#4b4132]">
                    The Old School RuneScape Bingo Platform
                  </p>
                  <h1 className="mb-6 font-display text-5xl font-bold text-osrs-gold osrs-text-shadow lg:text-7xl">
                    BingoScape
                  </h1>
                  <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed lg:mx-0 lg:text-xl">
                    Create custom Boards, organize Clan Events, and compete with
                    your Team. Track your progress in real-time with our
                    RuneLite Plugin integration.
                  </p>
                  <div className="flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
                    <Link href="/sign-in" className={stoneButton}>
                      Get Started Free
                    </Link>
                    <a
                      href="https://runelite.net/plugin-hub/show/bingoscape-companion"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={stoneButton}
                    >
                      <Download aria-hidden="true" className="h-5 w-5" />
                      Download Plugin
                    </a>
                  </div>
                </div>
                <BoardPreview />
              </div>
            </section>

            {/* Bingo Preview */}
            <div className="py-12 lg:py-16">
              <div className="flex flex-col items-center gap-12 lg:flex-row">
                <div className="flex-1">
                  <h2 className="osrs-heading mb-4 text-2xl font-bold lg:text-3xl">
                    See BingoScape in Action
                  </h2>
                  <p className="mb-6 text-lg text-muted-foreground">
                    Experience dynamic Boards with custom Goals, real-time
                    tracking, and seamless integration with your OSRS gameplay.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="h-2.5 w-2.5 bg-success"
                      />
                      <span className="text-sm">
                        Custom Goal creation and management
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="h-2.5 w-2.5 bg-pending"
                      />
                      <span className="text-sm">
                        Real-time progress tracking
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="h-2.5 w-2.5 bg-info"
                      />
                      <span className="text-sm">Team collaboration tools</span>
                    </div>
                  </div>
                </div>
                <div className="max-w-xl flex-1">
                  <div className="osrs-panel rounded-sm p-4">
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
            <div className="py-12 lg:py-16">
              <div className="mb-12 text-center">
                <h2 className="osrs-heading mb-4 text-3xl font-bold lg:text-4xl">
                  Everything You Need for OSRS Bingo
                </h2>
                <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                  Streamline your bingo competitions with powerful features
                  designed for Old School RuneScape players
                </p>
              </div>

              <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
                <div className="osrs-panel rounded-sm p-8">
                  <div className="osrs-slot mb-6 flex h-14 w-14 items-center justify-center rounded-sm">
                    <Trophy
                      aria-hidden="true"
                      className="h-7 w-7 text-primary"
                    />
                  </div>
                  <h3 className="mb-4 text-xl font-semibold">
                    Join Events & Track Progress
                  </h3>
                  <p className="text-muted-foreground">
                    Participate in Clan Events, track your Board completion
                    progress, and compete with other Teams in real-time
                    competitions.
                  </p>
                </div>

                <div className="osrs-panel rounded-sm p-8">
                  <div className="osrs-slot mb-6 flex h-14 w-14 items-center justify-center rounded-sm">
                    <Camera
                      aria-hidden="true"
                      className="h-7 w-7 text-primary"
                    />
                  </div>
                  <h3 className="mb-4 text-xl font-semibold">
                    Submit Evidence Instantly
                  </h3>
                  <p className="text-muted-foreground">
                    Upload screenshots directly through our RuneLite Plugin
                    without interrupting your gameplay experience.
                  </p>
                </div>

                <div className="osrs-panel rounded-sm p-8">
                  <div className="osrs-slot mb-6 flex h-14 w-14 items-center justify-center rounded-sm">
                    <Users
                      aria-hidden="true"
                      className="h-7 w-7 text-primary"
                    />
                  </div>
                  <h3 className="mb-4 text-xl font-semibold">
                    Team Collaboration Made Easy
                  </h3>
                  <p className="text-muted-foreground">
                    Form Teams, communicate with Clan members, and coordinate
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
