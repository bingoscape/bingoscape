import Link from "next/link"
import { Camera, Download, Trophy, Users, type LucideIcon } from "lucide-react"

import TemplatePreviewWithTooltip from "@/components/template-preview-with-tooltip"
import { parseExportedBingo } from "@/lib/bingo-template-schema"
import getTemplateBoard from "@/lib/getTemplateBoard"
import { buildDetailPreview } from "@/lib/template-preview"
import { BoardPreview } from "./board-preview"
import { DiscordSignInButton } from "./discord-sign-in-button"

// The showcase board is static, so it is parsed once at module load.
const showcase = parseExportedBingo(getTemplateBoard())
const showcasePreview = showcase.success
  ? buildDetailPreview(showcase.data, { isOwner: true })
  : null

const PLUGIN_URL = "https://runelite.net/plugin-hub/show/bingoscape-companion"

const stoneButton =
  "osrs-btn inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-sm px-6 py-3 text-lg font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-osrs-yellow sm:w-auto sm:px-8"

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Trophy,
    title: "Join Events & Track Progress",
    body: "Participate in Clan Events, track your Board completion progress, and compete with other Teams in real-time competitions.",
  },
  {
    icon: Camera,
    title: "Submit Evidence Instantly",
    body: "Upload screenshots directly through our RuneLite Plugin without interrupting your gameplay experience.",
  },
  {
    icon: Users,
    title: "Team Collaboration Made Easy",
    body: "Form Teams, communicate with Clan members, and coordinate your bingo strategy for maximum efficiency.",
  },
]

const HIGHLIGHTS = [
  { color: "bg-success", label: "Custom Goal creation and management" },
  { color: "bg-pending", label: "Real-time progress tracking" },
  { color: "bg-info", label: "Team collaboration tools" },
]

/** Sign up with Discord and download the Plugin carry equal weight. */
function CtaButtons({ centered = false }: { centered?: boolean }) {
  return (
    <div>
      <div
        className={
          centered
            ? "flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
            : "flex flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:justify-start"
        }
      >
        <DiscordSignInButton className={stoneButton} />
        <a
          href={PLUGIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={stoneButton}
        >
          <Download aria-hidden="true" className="h-5 w-5" />
          Download Plugin
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <p className="mt-4 text-sm">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="inline-flex min-h-11 items-center font-medium text-osrs-yellow underline underline-offset-4"
        >
          Log in
        </Link>
        <span aria-hidden="true"> · </span>
        <Link
          href="/sign-up"
          className="inline-flex min-h-11 items-center font-medium text-osrs-yellow underline underline-offset-4"
        >
          Sign up with a password
        </Link>
      </p>
    </div>
  )
}

export function LandingPage() {
  return (
    <>
      <section
        aria-labelledby="hero-title"
        className="osrs-texture border border-black bg-osrs-stone-900 text-osrs-parchment shadow-[inset_2px_2px_0_0_#6d6350,inset_-2px_-2px_0_0_#1c170f,4px_4px_0_0_rgb(0_0_0/0.7)]"
      >
        <div className="grid items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-12 lg:py-20">
          <div className="text-center lg:text-left">
            <p className="mb-4 inline-block border border-black bg-osrs-stone-950 px-3 py-1 text-sm font-medium text-osrs-parchment shadow-[inset_2px_2px_0_0_#17120b,inset_-1px_-1px_0_0_#4b4132]">
              The Old School RuneScape Bingo Platform
            </p>
            <h1
              id="hero-title"
              className="mb-6 font-display text-4xl font-bold text-osrs-gold osrs-text-shadow sm:text-5xl lg:text-7xl"
            >
              BingoScape
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed lg:mx-0 lg:text-xl">
              Create custom Boards, organize Clan Events, and compete with your
              Team. Track your progress in real-time with our RuneLite Plugin
              integration.
            </p>
            <CtaButtons />
          </div>
          {/* Hidden on small screens: the interactive Board below is the one preview there. */}
          <div className="hidden lg:block">
            <BoardPreview />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="demo-title"
        className="py-10 lg:py-16"
      >
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-12">
          <div className="flex-1">
            <h2
              id="demo-title"
              className="osrs-heading mb-4 text-2xl font-bold lg:text-3xl"
            >
              See BingoScape in Action
            </h2>
            <p className="mb-6 text-lg text-muted-foreground">
              Experience dynamic Boards with custom Goals, real-time tracking,
              and seamless integration with your OSRS gameplay. Tap a Tile to
              see its details.
            </p>
            <ul className="space-y-3">
              {HIGHLIGHTS.map((item) => (
                <li key={item.label} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 ${item.color}`}
                  />
                  <span className="text-sm">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="w-full max-w-xl flex-1">
            <div className="osrs-panel rounded-sm p-3 sm:p-4">
              {showcasePreview ? (
                <TemplatePreviewWithTooltip
                  preview={showcasePreview}
                  title="Live Bingo Board"
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="features-title" className="py-10 lg:py-16">
        <div className="mb-10 text-center">
          <h2
            id="features-title"
            className="osrs-heading mb-4 text-3xl font-bold lg:text-4xl"
          >
            Everything You Need for OSRS Bingo
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Streamline your bingo competitions with powerful features designed
            for Old School RuneScape players
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="osrs-panel rounded-sm p-6 md:p-8">
              <div className="osrs-slot mb-6 flex h-14 w-14 items-center justify-center rounded-sm">
                <Icon aria-hidden="true" className="h-7 w-7 text-primary" />
              </div>
              <h3 className="mb-4 text-xl font-semibold">{title}</h3>
              <p className="text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="closing-title"
        className="osrs-texture mb-8 border border-black bg-osrs-stone-900 px-4 py-10 text-center text-osrs-parchment shadow-[inset_2px_2px_0_0_#6d6350,inset_-2px_-2px_0_0_#1c170f,4px_4px_0_0_rgb(0_0_0/0.7)] sm:px-6"
      >
        <h2
          id="closing-title"
          className="mb-6 font-display text-3xl font-bold text-osrs-gold osrs-text-shadow"
        >
          Ready for your first bingo?
        </h2>
        <CtaButtons centered />
      </section>
    </>
  )
}
