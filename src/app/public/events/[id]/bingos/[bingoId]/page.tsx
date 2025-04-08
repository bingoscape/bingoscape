import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getPublicEvent, getPublicBingos, getPublicTeams, getPublicBingoDetails } from "@/app/actions/public-events"
import Link from "next/link"
import { ArrowLeft, Info } from "lucide-react"
import type { Metadata, ResolvingMetadata } from "next"
import { PublicBingoGrid } from "@/components/public-bingo-grid"

// Generate metadata for SEO
export async function generateMetadata(
  { params }: { params: { id: string; bingoId: string } },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const event = await getPublicEvent(params.id)

  if (!event) {
    return {
      title: "Bingo Not Found",
      description: "The requested bingo board could not be found or is not publicly available.",
    }
  }

  const bingo = await getPublicBingoDetails(params.bingoId)

  if (!bingo) {
    return {
      title: "Bingo Not Found",
      description: "The requested bingo board could not be found or is not publicly available.",
    }
  }

  return {
    title: `${bingo.title} | ${event.title} | BingoScape`,
    description: bingo.description ?? `View this bingo board from the ${event.title} event`,
    openGraph: {
      title: `${bingo.title} | ${event.title}`,
      description: bingo.description ?? `View this bingo board from the ${event.title} event`,
      type: "website",
    },
  }
}

export default async function PublicBingoPage({ params }: { params: { id: string; bingoId: string } }) {
  const event = await getPublicEvent(params.id)

  if (!event) {
    notFound()
  }

  const bingo = await getPublicBingoDetails(params.bingoId)

  if (!bingo) {
    notFound()
  }

  // Get all visible bingos to enable navigation between them
  const bingos = await getPublicBingos(params.id)

  // Get teams for this event and this specific bingo board
  const teams = await getPublicTeams(params.id, params.bingoId)

  // Find current bingo index for navigation
  const currentIndex = bingos.findIndex((b) => b.id === params.bingoId)
  const prevBingoId = currentIndex > 0 ? bingos[currentIndex - 1]!.id : undefined
  const nextBingoId = currentIndex < bingos.length - 1 ? bingos[currentIndex + 1]!.id : undefined

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b py-6">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">{bingo.title}</h1>
            <p className="text-lg text-muted-foreground">{event.title}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-6">
        <div className="flex justify-between items-center mb-6">
          <Link href={`/public/events/${params.id}`} passHref>
            <Button variant="ghost" className="pl-0">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Event
            </Button>
          </Link>

          {bingos.length > 1 && (
            <div className="flex gap-2">
              {bingos.map((b, index) => (
                <Link key={b.id} href={`/public/events/${params.id}/bingos/${b.id}`} passHref>
                  <Button variant={b.id === params.bingoId ? "default" : "outline"} size="sm">
                    Board {index + 1}
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </div>

        {bingo.description && (
          <div className="mb-6 max-w-3xl mx-auto">
            <details className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-1.5 rounded-lg bg-muted p-4 text-gray-900 dark:text-white">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  <h2 className="font-medium">Board Description</h2>
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
                <p>{bingo.description}</p>
              </div>
            </details>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <PublicBingoGrid
            bingo={bingo}
            teams={teams}
            prevBingoId={prevBingoId}
            nextBingoId={nextBingoId}
            eventId={params.id}
          />
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
