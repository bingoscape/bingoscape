import type { Metadata } from "next"
import type { UUID } from "crypto"
import { getEventById } from "@/app/actions/events"
import { getBingoById } from "@/app/actions/getBingoById"

export async function generateMetadata(props: {
  params: Promise<{ id: UUID; bingoId: string }>
}): Promise<Metadata> {
  const { id, bingoId } = await props.params
  const [eventData, bingo] = await Promise.all([
    getEventById(id),
    getBingoById(bingoId),
  ])
  const eventTitle = eventData?.event.title ?? "Event"
  const bingoTitle = bingo?.title ?? "Bingo"
  return {
    title: `${bingoTitle} — ${eventTitle}`,
  }
}

export default function BingoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
