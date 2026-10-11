import Image from "next/image"
import { EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import type { TemplateCardPreview } from "@/lib/template-preview"

/** Past these sizes cells are too small for images or tier numbers. */
const MAX_CELLS_WITH_IMAGES = 49
const MAX_CELLS_WITH_TIERS = 36

interface TemplateMiniBoardProps {
  preview: TemplateCardPreview
  className?: string
}

/**
 * Static, server-rendered thumbnail of a template's board for list cards.
 * Decorative: the card carries the real text (size, type), so this is hidden
 * from assistive tech. Hidden Tiles are drawn as dashed "?" slots.
 */
export function TemplateMiniBoard({
  preview,
  className,
}: TemplateMiniBoardProps) {
  const { rows, columns, bingoType, cells } = preview
  const total = rows * columns
  const byIndex = new Map(cells.map((cell) => [cell.index, cell]))
  const showImages = total <= MAX_CELLS_WITH_IMAGES
  const showTiers = bingoType === "progression" && total <= MAX_CELLS_WITH_TIERS

  return (
    <div
      aria-hidden="true"
      className={cn(
        "osrs-panel-inset mx-auto grid w-full max-w-56 gap-0.5 rounded-sm p-1.5",
        className
      )}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        aspectRatio: `${columns} / ${rows}`,
      }}
    >
      {Array.from({ length: total }, (_, index) => {
        const cell = byIndex.get(index)

        if (!cell) {
          return (
            <div
              key={index}
              className="border-border/40 rounded-sm border border-dashed"
            />
          )
        }

        if (cell.masked) {
          return (
            <div
              key={index}
              className="border-muted-foreground/30 bg-muted/20 text-muted-foreground/60 flex items-center justify-center rounded-sm border border-dashed"
            >
              {total <= MAX_CELLS_WITH_TIERS ? (
                <EyeOff className="size-3" />
              ) : null}
            </div>
          )
        }

        return (
          <div
            key={index}
            className="osrs-slot relative flex items-center justify-center overflow-hidden rounded-sm"
          >
            {showImages && cell.headerImage ? (
              <Image
                src={cell.headerImage}
                alt=""
                fill
                sizes="48px"
                className="object-contain p-0.5"
              />
            ) : showTiers ? (
              <span className="text-muted-foreground text-[10px] leading-none font-semibold tabular-nums">
                {cell.tier + 1}
              </span>
            ) : (
              <span className="bg-primary/25 absolute inset-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}
