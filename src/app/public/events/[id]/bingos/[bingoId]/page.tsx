import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getPublicEvent } from "@/app/actions/public-events"
import { db } from "@/server/db"
import { bingos, tiles } from "@/server/db/schema"
import { eq, and, asc } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { Metadata, ResolvingMetadata } from "next"
import type { UUID } from "crypto"
import Image from "next/image"
import getRandomFrog from "@/lib/getRandomFrog"

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

  const bingo = await db.query.bingos.findFirst({
    where: and(eq(bingos.id, params.bingoId as UUID), eq(bingos.eventId, params.id as UUID), eq(bingos.visible, true)),
  })

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

  const bingo = await db.query.bingos.findFirst({
    where: and(eq(bingos.id, params.bingoId as UUID), eq(bingos.eventId, params.id as UUID), eq(bingos.visible, true)),
  })

  if (!bingo) {
    notFound()
  }

  // Get visible tiles (non-hidden)
  const bingoTiles = await db
    .select()
    .from(tiles)
    .where(and(eq(tiles.bingoId, params.bingoId as UUID), eq(tiles.isHidden, false)))
    .orderBy(asc(tiles.index))
    .execute()

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{bingo.title}</h1>
            <p className="text-lg opacity-90">{event.title}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8">
        <div className="mb-6">
          <Link href={`/public/events/${params.id}`} passHref>
            <Button variant="ghost" className="pl-0">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Event
            </Button>
          </Link>
        </div>

        {bingo.description && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{bingo.description}</p>
            </CardContent>
          </Card>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Bingo Board</h2>
          <div className="aspect-square w-full max-w-[80vh] mx-auto">
            <div
              className="grid gap-2 h-full"
              style={{
                gridTemplateColumns: `repeat(${bingo.columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${bingo.rows}, minmax(0, 1fr))`,
              }}
            >
              {bingoTiles.map((tile) => (
                <div key={tile.id} className="border-2 border-primary rounded overflow-hidden aspect-square relative">
                  {tile.headerImage ? (
                    <Image
                      src={tile.headerImage || getRandomFrog()}
                      alt={tile.title}
                      fill
                      className="object-contain transition-transform duration-300 ease-in-out hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground text-lg font-semibold">{tile.title}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Want to participate?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Create an account or log in to participate in this bingo event.</p>
            <div className="flex flex-wrap gap-4">
              <Link href="/login" passHref>
                <Button>Log In</Button>
              </Link>
              <Link href="/" passHref>
                <Button variant="outline">Learn More</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
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

