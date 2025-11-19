import { Badge } from "@/components/ui/badge"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Users, Trophy, Coins, Grid3X3, Info } from "lucide-react"
import { getPublicEvent, getPublicBingos, getPublicTeams, getPublicBingoDetails } from "@/app/actions/public-events"
import Link from "next/link"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import type { Metadata, ResolvingMetadata } from "next"
import { PublicBingoGrid } from "@/components/public-bingo-grid"

// Generate metadata for SEO
export async function generateMetadata(props: { params: Promise<{ id: string }> }, _parent: ResolvingMetadata): Promise<Metadata> {
  const params = await props.params;
  const event = await getPublicEvent(params.id)

  if (!event) {
    return {
      title: "Event Not Found",
      description: "The requested event could not be found or is not publicly available.",
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://next.bingoscape.org"
  const eventUrl = `${baseUrl}/public/events/${params.id}`

  // Format dates for description
  const startDate = new Date(event.startDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  const endDate = new Date(event.endDate).toLocaleDateString("en-US", {
    month: "long", 
    day: "numeric",
    year: "numeric",
  })

  const description = event.description ?? 
    `Join this RuneScape bingo event from ${startDate} to ${endDate}. ${event.clanName ? `Hosted by ${event.clanName}.` : ""} ${event.bingoCount > 0 ? `Features ${event.bingoCount} bingo board${event.bingoCount === 1 ? "" : "s"}.` : ""}`

  return {
    title: `${event.title} | BingoScape`,
    description,
    openGraph: {
      title: event.title,
      description,
      type: "website",
      url: eventUrl,
      siteName: "BingoScape",
      images: [
        {
          url: `${eventUrl}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${event.title} - BingoScape Event`,
        },
      ],
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: [`${eventUrl}/opengraph-image`],
      creator: "@bingoscape",
      site: "@bingoscape",
    },
    metadataBase: new URL(baseUrl),
  }
}

export default async function PublicEventPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const event = await getPublicEvent(params.id)

  if (!event) {
    notFound()
  }

  const bingos = await getPublicBingos(params.id)

  // Get the first bingo's details for display if available
  const firstBingoDetails = bingos.length > 0 ? await getPublicBingoDetails(bingos[0]!.id) : null

  // Get teams for this event and the first bingo board
  const teams = firstBingoDetails ? await getPublicTeams(params.id, firstBingoDetails.id) : []

  // Find next and previous bingo IDs for the first bingo
  const nextBingoId = bingos.length > 1 ? bingos[1]!.id : undefined

  // Format dates
  const startDate = new Date(event.startDate)
  const endDate = new Date(event.endDate)
  const formattedStartDate = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const formattedEndDate = endDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // Calculate event status
  const now = new Date()
  let eventStatus = "upcoming"
  if (now > endDate) {
    eventStatus = "completed"
  } else if (now >= startDate) {
    eventStatus = "active"
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{event.title}</h1>
            {event.clanName && (
              <div className="flex items-center mb-2">
                <Users className="mr-2 h-5 w-5" />
                <span className="text-lg">Hosted by {event.clanName}</span>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3 mt-1">
              <Badge
                variant={eventStatus === "active" ? "default" : eventStatus === "upcoming" ? "secondary" : "outline"}
              >
                {eventStatus === "active" ? "Active" : eventStatus === "upcoming" ? "Upcoming" : "Completed"}
              </Badge>
              {event.bingoCount > 0 && (
                <Badge variant="outline">
                  {event.bingoCount} {event.bingoCount === 1 ? "Bingo" : "Bingos"}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8">
        {/* Event Details Bar */}
        <div className="flex flex-wrap justify-center gap-6 mb-8 text-center">
          <div className="flex flex-col items-center">
            <Calendar className="h-5 w-5 mb-1 text-muted-foreground" />
            <p className="font-medium">Dates</p>
            <p className="text-sm text-muted-foreground">{formattedStartDate.split(",")[0]}</p>
            <p className="text-sm text-muted-foreground">to</p>
            <p className="text-sm text-muted-foreground">{formattedEndDate.split(",")[0]}</p>
          </div>

          <div className="flex flex-col items-center">
            <Clock className="h-5 w-5 mb-1 text-muted-foreground" />
            <p className="font-medium">Duration</p>
            <p className="text-sm text-muted-foreground">
              {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days
            </p>
          </div>

          {event.minimumBuyIn > 0 && (
            <div className="flex flex-col items-center">
              <Coins className="h-5 w-5 mb-1 text-muted-foreground" />
              <p className="font-medium">Buy-In</p>
              <p className="text-sm text-muted-foreground">{formatRunescapeGold(event.minimumBuyIn)} GP</p>
            </div>
          )}

          {event.basePrizePool > 0 && (
            <div className="flex flex-col items-center">
              <Trophy className="h-5 w-5 mb-1 text-muted-foreground" />
              <p className="font-medium">Prize Pool</p>
              <p className="text-sm text-muted-foreground">{formatRunescapeGold(event.basePrizePool)} GP</p>
            </div>
          )}

          <div className="flex flex-col items-center">
            <Users className="h-5 w-5 mb-1 text-muted-foreground" />
            <p className="font-medium">Teams</p>
            <p className="text-sm text-muted-foreground">{teams.length}</p>
          </div>
        </div>

        {/* Description Accordion */}
        {event.description && (
          <div className="mb-8 max-w-3xl mx-auto">
            <details className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-1.5 rounded-lg bg-muted p-4 text-gray-900 dark:text-white">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  <h2 className="font-medium">About This Event</h2>
                </div>
                <svg
                  className="h-5 w-5 shrink-0 transition duration-300 group-open:-rotate-180"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>

              <div className="mt-4 px-4 leading-relaxed text-gray-700 dark:text-gray-200">
                <p>{event.description}</p>
              </div>
            </details>
          </div>
        )}

        {/* Bingo Board Display */}
        {firstBingoDetails ? (
          <div className="mb-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2 mb-2 md:mb-0">
                <Grid3X3 className="h-6 w-6" />
                {firstBingoDetails.title}
              </h2>

              {bingos.length > 1 && (
                <div className="flex gap-2">
                  {bingos.map((bingo, index) => (
                    <Link key={bingo.id} href={`/public/events/${event.id}/bingos/${bingo.id}`} passHref>
                      <Button variant={bingo.id === firstBingoDetails.id ? "default" : "outline"} size="sm">
                        Board {index + 1}
                      </Button>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="max-w-4xl mx-auto">
              <PublicBingoGrid bingo={firstBingoDetails} teams={teams} nextBingoId={nextBingoId} eventId={params.id} />
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Bingo Boards Available</h2>
            <p className="text-muted-foreground">This event doesn&apos;t have any public bingo boards yet.</p>
          </div>
        )}
      </main>

      <footer className="border-t py-6 md:py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center justify-center gap-4 md:flex-row md:gap-6">
            <p className="text-center text-sm leading-loose text-muted-foreground">
              © {new Date().getFullYear()} BingoScape. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
