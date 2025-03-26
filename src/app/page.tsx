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
          <div className="flex flex-col lg:flex-row gap-12 items-start justify-between py-12">
            <div className="space-y-8 max-w-xl">
              <h1 className="text-5xl font-bold text-primary">BingoScape</h1>

              <p className="text-lg text-muted-foreground">
                BingoScape is the ultimate platform for Old School RuneScape bingo competitions. Create custom bingo
                boards, organize clan events, form teams, and compete with friends. Our RuneLite plugin lets you submit
                screenshots, track completions, and view your team&apos;s progress directly in-game without interrupting your
                gameplay.
              </p>

              <div className="space-y-2">
                <p className="flex items-center gap-2">
                  <span className="text-red-500">❤️</span> Join Events & Track Progress
                </p>
                <p className="flex items-center gap-2">
                  <span>📸</span> Submit Evidence Instantly
                </p>
                <p className="flex items-center gap-2">
                  <span>🤝</span> Team Collaboration Made Easy
                </p>
              </div>

              <p className="text-muted-foreground">
                Start playing smarter and take your OSRS bingo experience to the next level!
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8">
                <a
                  href="https://discord.gg/p2J6DQ2SkC"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-card p-6 rounded-lg text-center flex flex-col items-center hover:bg-muted transition-colors"
                >
                  <div className="bg-muted p-4 rounded-full mb-4">
                    <svg width="32" height="32" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Join our Discord</h3>
                  <p className="text-sm text-muted-foreground">Contact us for support, feedback or leave toy ideas</p>
                </a>

                <a
                  href="https://runelite.net/plugin-hub/show/bingoscape-companion"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-card p-6 rounded-lg text-center flex flex-col items-center hover:bg-muted transition-colors"
                >
                  <div className="bg-muted p-4 rounded-full mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM15.88 8.29L10 14.17L8.12 12.29C7.73 11.9 7.1 11.9 6.71 12.29C6.32 12.68 6.32 13.31 6.71 13.7L9.3 16.29C9.69 16.68 10.32 16.68 10.71 16.29L17.3 9.7C17.69 9.31 17.69 8.68 17.3 8.29C16.91 7.9 16.27 7.9 15.88 8.29Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Get the Companion app</h3>
                  <p className="text-sm text-muted-foreground">Download the RuneLite plugin and start playing</p>
                </a>

                <Link
                  href="/sign-in"
                  className="bg-card p-6 rounded-lg text-center flex flex-col items-center hover:bg-muted transition-colors"
                >
                  <div className="bg-muted p-4 rounded-full mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Start using the app</h3>
                  <p className="text-sm text-muted-foreground">Create or participate in an event or bingo</p>
                </Link>
              </div>
            </div>

            <div className="w-full lg:w-1/2 mt-8 lg:mt-0">
              <div className="bg-card rounded-lg p-4 w-full max-w-xl mx-auto">
                <TemplatePreviewWithTooltip
                  templateData={getTemplateBoard()}
                  title="Showcase"
                  isDetailView={true}
                  fixedTooltipIndex={4}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

