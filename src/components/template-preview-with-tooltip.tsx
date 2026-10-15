"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, EyeOff, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn, getOptimizedImageUrl } from "@/lib/utils"
import type {
  TemplatePreviewData,
  TemplatePreviewTile,
} from "@/lib/template-preview"

interface TemplatePreviewWithTooltipProps {
  /** Built on the server (`buildDetailPreview`): hidden tiles already masked. */
  preview: TemplatePreviewData
  title: string
  className?: string
  /** Show the tier ladder and pattern bonuses under the board. Default true. */
  showStructure?: boolean
  /** Tile index (board position) selected at first. Defaults to the first tile. */
  initialSelectedIndex?: number
}

function xp(value: number) {
  return `${value.toLocaleString("en-US")} XP`
}

/**
 * Tap-a-tile board preview. The selected Tile's details render in a panel
 * below the board (never a hover card), so it works on touch and never covers
 * the board. Previous/Next buttons step through Tiles on dense boards whose
 * cells are small. Progression boards also get a tier ladder, and boards with
 * pattern bonuses list them.
 */
export default function TemplatePreviewWithTooltip({
  preview,
  title,
  className,
  showStructure = true,
  initialSelectedIndex,
}: TemplatePreviewWithTooltipProps) {
  const { rows, columns, tiles, bingoType } = preview
  const isProgression = bingoType === "progression"
  const byIndex = new Map(tiles.map((tile) => [tile.index, tile]))

  const [selectedIndex, setSelectedIndex] = useState<number | undefined>(
    initialSelectedIndex !== undefined && byIndex.has(initialSelectedIndex)
      ? initialSelectedIndex
      : tiles[0]?.index
  )

  if (tiles.length === 0) {
    return (
      <div
        className={cn(
          "osrs-panel-inset text-muted-foreground rounded-sm p-6 text-center text-sm",
          className
        )}
      >
        This template doesn&apos;t have any tiles yet.
      </div>
    )
  }

  const selectedPosition = tiles.findIndex((t) => t.index === selectedIndex)
  const selectedTile = tiles[selectedPosition]
  const step = (delta: number) => {
    const next = tiles[selectedPosition + delta]
    if (next) setSelectedIndex(next.index)
  }
  const showCellText = columns <= 7

  return (
    <div className={cn("space-y-4", className)}>
      <div
        role="group"
        aria-label={`${title}: tap a tile to see its details`}
        className="osrs-panel-inset mx-auto grid w-full max-w-xl gap-1 rounded-sm p-1.5 sm:gap-1.5 sm:p-2"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          aspectRatio: `${columns} / ${rows}`,
        }}
      >
        {Array.from({ length: rows * columns }, (_, index) => {
          const tile = byIndex.get(index)
          if (!tile) {
            return (
              <div
                key={index}
                aria-hidden="true"
                className="border-border/40 rounded-sm border border-dashed"
              />
            )
          }
          return (
            <TileButton
              key={index}
              tile={tile}
              selected={index === selectedIndex}
              showTier={isProgression}
              showText={showCellText}
              onSelect={() => setSelectedIndex(index)}
            />
          )
        })}
      </div>

      {selectedTile ? (
        <div
          aria-live="polite"
          className="osrs-panel-inset space-y-3 rounded-sm p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold wrap-break-word">
              {selectedTile.title}
            </h3>
            {selectedTile.weight !== null ? (
              <div className="bg-warning/30 flex shrink-0 items-center gap-1 rounded-sm px-2 py-1">
                <Zap aria-hidden="true" className="text-warning size-3.5" />
                <span className="text-xs font-medium">
                  {xp(selectedTile.weight)}
                </span>
              </div>
            ) : null}
          </div>

          {isProgression || selectedTile.isHidden ? (
            <div className="flex flex-wrap gap-1.5">
              {isProgression ? (
                <Badge variant="info">Tier {selectedTile.tier + 1}</Badge>
              ) : null}
              {selectedTile.masked ? (
                <Badge variant="pending">
                  <EyeOff aria-hidden="true" className="size-3" />
                  Hidden
                </Badge>
              ) : selectedTile.isHidden ? (
                <Badge variant="pending">
                  <EyeOff aria-hidden="true" className="size-3" />
                  Hidden from players until revealed
                </Badge>
              ) : null}
            </div>
          ) : null}

          {selectedTile.masked ? (
            <p className="text-muted-foreground text-sm">
              The creator keeps this tile secret. Its name, XP and goals are
              part of the template, but only the creator sees them here.
            </p>
          ) : null}

          {selectedTile.description ? (
            <p className="text-muted-foreground text-sm whitespace-pre-line">
              {selectedTile.description}
            </p>
          ) : null}

          {selectedTile.goals.length > 0 ? (
            <div>
              <h4 className="mb-1 text-xs font-semibold">Goals</h4>
              <ul className="space-y-1 text-xs">
                {selectedTile.goals.map((goal, idx) => (
                  <li key={idx} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {goal.description}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      Target: {goal.targetValue.toLocaleString("en-US")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="border-border flex items-center justify-between gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedPosition <= 0}
              onClick={() => step(-1)}
            >
              <ChevronLeft aria-hidden="true" />
              Previous
            </Button>
            <span className="text-muted-foreground text-xs tabular-nums">
              Tile {selectedPosition + 1} of {tiles.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedPosition >= tiles.length - 1}
              onClick={() => step(1)}
            >
              Next
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

      {showStructure && isProgression && preview.tiers.length > 0 ? (
        <section aria-labelledby="template-tier-ladder" className="space-y-2">
          <h3 id="template-tier-ladder" className="text-sm font-semibold">
            Tier ladder
          </h3>
          <ol className="space-y-2">
            {preview.tiers.map((tier, index) => (
              <li
                key={tier.tier}
                className="osrs-slot flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-sm p-3 text-sm"
              >
                <span className="font-medium">Tier {tier.tier + 1}</span>
                <span className="text-muted-foreground">
                  {tier.tileCount} {tier.tileCount === 1 ? "tile" : "tiles"}
                  {tier.maskedCount < tier.tileCount
                    ? ` · ${xp(tier.totalXp)}${tier.maskedCount > 0 ? " + hidden" : ""}`
                    : ""}
                </span>
                <span className="text-muted-foreground w-full text-xs">
                  {tier.unlockXp !== null
                    ? `Earn ${xp(tier.unlockXp)} in this tier to unlock Tier ${(preview.tiers[index + 1]?.tier ?? tier.tier + 1) + 1}.`
                    : "Final tier."}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {showStructure && preview.bonuses ? (
        <section
          aria-labelledby="template-pattern-bonuses"
          className="space-y-2"
        >
          <h3 id="template-pattern-bonuses" className="text-sm font-semibold">
            Pattern bonuses
          </h3>
          <ul className="text-muted-foreground space-y-1 text-sm">
            {preview.bonuses.rows.map((bonus) => (
              <li key={`row-${bonus.index}`}>
                Row {bonus.index + 1}: +{xp(bonus.xp)}
              </li>
            ))}
            {preview.bonuses.columns.map((bonus) => (
              <li key={`column-${bonus.index}`}>
                Column {bonus.index + 1}: +{xp(bonus.xp)}
              </li>
            ))}
            {preview.bonuses.mainDiagonal > 0 ? (
              <li>Main diagonal: +{xp(preview.bonuses.mainDiagonal)}</li>
            ) : null}
            {preview.bonuses.antiDiagonal > 0 ? (
              <li>Anti-diagonal: +{xp(preview.bonuses.antiDiagonal)}</li>
            ) : null}
            {preview.bonuses.completeBoard > 0 ? (
              <li>Complete board: +{xp(preview.bonuses.completeBoard)}</li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function TileButton({
  tile,
  selected,
  showTier,
  showText,
  onSelect,
}: {
  tile: TemplatePreviewTile
  selected: boolean
  showTier: boolean
  showText: boolean
  onSelect: () => void
}) {
  const label = [
    tile.masked ? "Hidden tile" : tile.title,
    showTier ? `tier ${tile.tier + 1}` : null,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onSelect}
      className={cn(
        "focus-visible:ring-ring relative flex aspect-square min-h-0 items-center justify-center overflow-hidden rounded-sm border focus-visible:ring-2 focus-visible:outline-hidden",
        tile.masked
          ? "border-muted-foreground/40 bg-muted/20 text-muted-foreground border-dashed"
          : "osrs-slot",
        selected && "ring-osrs-yellow ring-2"
      )}
    >
      {tile.masked ? (
        <span aria-hidden="true" className="text-sm font-bold">
          ?
        </span>
      ) : tile.headerImage ? (
        <Image
          src={getOptimizedImageUrl(tile.headerImage)}
          alt=""
          fill
          sizes="(min-width: 640px) 80px, 15vw"
          className="object-contain p-1"
        />
      ) : showText ? (
        <span
          aria-hidden="true"
          className="line-clamp-3 px-1 text-center text-[10px] leading-tight font-semibold wrap-anywhere sm:text-xs"
        >
          {tile.title}
        </span>
      ) : (
        <span aria-hidden="true" className="bg-primary/25 absolute inset-0" />
      )}
      {showTier ? (
        <span
          aria-hidden="true"
          className="bg-background/80 absolute top-0 left-0 rounded-br-sm px-1 text-[10px] leading-4 font-semibold tabular-nums"
        >
          {tile.tier + 1}
        </span>
      ) : null}
    </button>
  )
}
