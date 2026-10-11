import { Axe, Check, Clock, Crown, Fish, Flame, Gem, type LucideIcon, Pickaxe, Shield, Skull, Sword } from "lucide-react"

import { cn } from "@/lib/utils"

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

export function BoardPreview() {
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
