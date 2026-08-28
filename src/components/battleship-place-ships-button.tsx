import Link from "next/link"
import { Ship } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BattleshipPlaceShipsButtonProps {
  eventId: string
  bingoId: string
  teamId: string | undefined
  className?: string
}

export function BattleshipPlaceShipsButton({
  eventId,
  bingoId,
  teamId,
  className,
}: BattleshipPlaceShipsButtonProps) {
  if (!teamId) return null

  return (
    <Button variant="outline" className={className} asChild>
      <Link
        href={`/events/${eventId}/bingos/${bingoId}/ships?teamId=${teamId}`}
      >
        <Ship className="mr-2 h-4 w-4" />
        Place ships
      </Link>
    </Button>
  )
}
