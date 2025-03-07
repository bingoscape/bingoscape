import { Badge } from "@/components/ui/badge"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Users, Trophy, Coins } from "lucide-react"
import { getPublicEvent, getPublicBingos } from "@/app/actions/public-events"
import Link from "next/link"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import type { Metadata, ResolvingMetadata } from "next"

// Generate metadata for SEO
export async function generateMetadata(
  { params }: { params: { id: string } },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const event = await getPublicEvent(params.id)

  if (!event) {
    return {
      title: "Event Not Found",
      description: "The requested event could not be found or is not publicly available.",
    }
  }

  return {
    title: `${event.title} | BingoScape`,
    description:
      event.description ??
      `Join this RuneScape bingo event from ${new Date(event.startDate).toLocaleDateString()} to ${new Date(event.endDate).toLocaleDateString()}`,
    openGraph: {
      title: event.title,
      description: event.description ?? `Join this RuneScape bingo event!`,
      type: "website",
    },
  }
}

export default async function PublicEventPage({ params }: { params: { id: string } }) {
  const event = await getPublicEvent(params.id)

  if (!event) {
    notFound()
  }

  const bingos = await getPublicBingos(params.id)

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
      <header className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">{event.title}</h1>
            {event.clanName && (
              <div className="flex items-center mb-4">
                <Users className="mr-2 h-5 w-5" />
                <span className="text-lg">Hosted by {event.clanName}</span>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              <Badge
                variant={eventStatus === "active" ? "default" : eventStatus === "upcoming" ? "secondary" : "outline"}
              >
                {eventStatus === "active" ? "Active" : eventStatus === "upcoming" ? "Upcoming" : "Completed"}
              </Badge>
              {event.bingoCount > 0 && (
                <Badge variant="outline" className="bg-primary-foreground/10">
                  {event.bingoCount} {event.bingoCount === 1 ? "Bingo" : "Bingos"}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* Event Description */}
            <Card>
              <CardHeader>
                <CardTitle>About This Event</CardTitle>
              </CardHeader>
              <CardContent>
                {event.description ? (
                  <div className="prose max-w-none dark:prose-invert">
                    <p>{event.description}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">No description provided</p>
                )}
              </CardContent>
            </Card>

            {/* Bingo Boards */}
            {bingos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Bingo Boards</CardTitle>
                  <CardDescription>
                    This event has {bingos.length} public bingo {bingos.length === 1 ? "board" : "boards"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {bingos.map((bingo) => (
                      <Card key={bingo.id} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{bingo.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-2">
                          <p className="text-sm text-muted-foreground">
                            {bingo.description ?? "No description provided"}
                          </p>
                          <p className="text-sm mt-2">
                            {bingo.rows}×{bingo.columns} grid
                          </p>
                        </CardContent>
                        <CardFooter>
                          <Link href={`/public/events/${event.id}/bingos/${bingo.id}`} passHref>
                            <Button variant="outline" size="sm">
                              View Board
                            </Button>
                          </Link>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Event Details */}
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start">
                  <Calendar className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Dates</p>
                    <p className="text-sm text-muted-foreground">{formattedStartDate}</p>
                    <p className="text-sm text-muted-foreground">to</p>
                    <p className="text-sm text-muted-foreground">{formattedEndDate}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Clock className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Duration</p>
                    <p className="text-sm text-muted-foreground">
                      {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days
                    </p>
                  </div>
                </div>

                {event.minimumBuyIn > 0 && (
                  <div className="flex items-start">
                    <Coins className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Minimum Buy-In</p>
                      <p className="text-sm text-muted-foreground">{formatRunescapeGold(event.minimumBuyIn)} GP</p>
                    </div>
                  </div>
                )}

                {event.basePrizePool > 0 && (
                  <div className="flex items-start">
                    <Trophy className="h-5 w-5 mr-3 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Base Prize Pool</p>
                      <p className="text-sm text-muted-foreground">{formatRunescapeGold(event.basePrizePool)} GP</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Join Event */}
            <Card>
              <CardHeader>
                <CardTitle>Interested in Joining?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Create an account or log in to participate in this event.
                </p>
                <div className="flex flex-col gap-2">
                  <Link href="/login" passHref>
                    <Button className="w-full">Log In</Button>
                  </Link>
                  <Link href="/" passHref>
                    <Button variant="outline" className="w-full">
                      Learn More
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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

