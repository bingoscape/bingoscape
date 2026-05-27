"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { seedRandomBattleshipHits } from "@/app/actions/battleship"

interface BattleshipSeedHitsButtonProps {
  bingoId: string
}

export function BattleshipSeedHitsButton({
  bingoId,
}: BattleshipSeedHitsButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleSeed = () => {
    startTransition(async () => {
      const result = await seedRandomBattleshipHits(bingoId, 10)
      if (result.success) {
        toast({
          title: "Random hits added",
          description: `Inserted ${result.inserted ?? 0} test hits.`,
        })
        router.refresh()
      } else {
        toast({
          title: "Failed to add hits",
          description: result.error ?? "Unknown error",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <Button variant="outline" onClick={handleSeed} disabled={isPending}>
      {isPending ? "Adding hits..." : "Add random hits"}
    </Button>
  )
}
