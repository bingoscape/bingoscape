"use client"

import React from "react"
import Image from "next/image"
import { CheckCircle2, Clock, Lock } from "lucide-react"
import type { Tile } from "@/types/model"
import { BattleshipMarkBadge } from "@/components/battleship-mark-badge"
import { MARK_LABEL, type BattleshipMark } from "@/lib/battleship-marks"
import getRandomFrog from "@/lib/getRandomFrog"
import { getTileTeamStatus } from "@/lib/tile-status"
import { cn } from "@/lib/utils"

interface BingoTileProps {
  tile: Tile
  onClick: (tile: Tile) => void
  onTogglePlaceholder: (tile: Tile) => void
  userRole: "participant" | "management" | "admin"
  currentTeamId?: string
  /** True when the board layout is locked (not in "Edit layout" mode). */
  isLocked: boolean
  isLoading?: boolean
  /** Tile is the one shown in the side panel. */
  selected?: boolean
  /** Roving tabindex: 0 for the active cell, -1 for the rest. */
  tabIndex?: number
  /** 1-based position, used for the accessible name. */
  row?: number
  column?: number
  /** Tier ladder: the Tile's Tier is still locked for the viewed Team. */
  tierLocked?: boolean
  /** Does not match the active Board filter: shown faded. */
  dimmed?: boolean
  /** Highlight (delete preview in layout edit mode). */
  highlighted?: boolean
  /** Public / read-only view: never toggles placeholders. */
  readOnly?: boolean
  /** Index in the tiles array, used by the grid for roving focus. */
  gridIndex?: number
  /**
   * Battleship: the viewer's Team hit, missed or sank here. Ignored for blind
   * Tiles, which can never carry a marker.
   */
  mark?: BattleshipMark | null
}

const STATUS_LABEL = {
  completed: "completed",
  needs_review: "changes requested",
  pending: "pending review",
  approved: "submitted",
} as const

/**
 * One slot of the Board. Sized entirely by the grid track it sits in (see
 * `.osrs-board-fit`); the face adapts to the slot size with container queries.
 */
export const BingoTile = React.memo(function BingoTile({
  tile,
  onClick,
  onTogglePlaceholder,
  userRole,
  currentTeamId,
  isLocked,
  isLoading = false,
  selected = false,
  tabIndex = -1,
  row,
  column,
  tierLocked = false,
  dimmed = false,
  highlighted = false,
  readOnly = false,
  gridIndex,
  mark = null,
}: BingoTileProps) {
  const isManagement = userRole === "management" || userRole === "admin"

  const { completion, submissionState } = React.useMemo(
    () => getTileTeamStatus(tile, currentTeamId),
    [tile, currentTeamId]
  )

  // Hidden Tiles keep their cell. Players get an empty, unfocusable cell.
  if (tile.isHidden && !isManagement) {
    return (
      <div
        aria-hidden="true"
        data-grid-index={gridIndex}
        className="rounded-sm"
      />
    )
  }

  // Blind Tiles (battleship, before the start) keep their cell and their place
  // in the keyboard order, but have nothing to open: no content, no status.
  if (tile.isBlind) {
    const position =
      row !== undefined && column !== undefined
        ? `Row ${row}, column ${column}: `
        : ""
    return (
      <div
        role="gridcell"
        aria-label={`${position}${tile.title}, objective hidden until the event starts`}
        aria-disabled="true"
        tabIndex={tabIndex}
        data-grid-index={gridIndex}
        data-blind="true"
        className={cn(
          "osrs-tile osrs-slot relative flex h-full w-full cursor-default items-center justify-center overflow-hidden rounded-sm border-[3px]",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring focus-visible:outline-solid",
          dimmed && "opacity-30 saturate-50"
        )}
      >
        <span className="osrs-tile-text text-muted-foreground line-clamp-2 px-[6%] text-center font-display leading-tight @max-[43px]/tile:hidden">
          {tile.title}
        </span>
      </div>
    )
  }

  const canToggleReveal = tile.isHidden && !isLocked && isManagement && !readOnly

  const handleActivate = () => {
    if (canToggleReveal) {
      onTogglePlaceholder(tile)
      return
    }
    // In layout edit mode, only hidden placeholders are toggled; other clicks
    // still select the Tile so it can be edited.
    onClick(tile)
  }

  const statusKey: keyof typeof STATUS_LABEL | null =
    completion === "completed" ? "completed" : submissionState
  const statusText = statusKey ? STATUS_LABEL[statusKey] : "not started"

  const position =
    row !== undefined && column !== undefined
      ? `Row ${row}, column ${column}: `
      : ""
  const label = tile.isHidden
    ? `${position}Hidden tile${canToggleReveal ? ", activate to reveal" : ""}`
    : `${position}${tile.title}, ${tile.weight} XP, ${statusText}${tierLocked ? ", locked" : ""}${mark ? `, ${MARK_LABEL[mark].toLowerCase()}` : ""}`

  return (
    <div
      role="gridcell"
      aria-label={label}
      aria-selected={selected}
      tabIndex={tabIndex}
      data-grid-index={gridIndex}
      data-selected={selected ? "true" : undefined}
      title={tile.isHidden ? undefined : `${tile.title} (${tile.weight} XP)`}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleActivate()
        }
      }}
      className={cn(
        "osrs-tile group relative h-full w-full cursor-pointer touch-manipulation overflow-hidden rounded-sm transition-[filter] duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring focus-visible:outline-solid",
        tile.isHidden
          ? "border-2 border-dashed border-muted-foreground/50 bg-field hover:border-primary"
          : "osrs-slot border-[3px] hover:brightness-110 active:brightness-95",
        !tile.isHidden &&
          (completion === "completed"
            ? "border-success"
            : submissionState === "needs_review"
              ? "border-warning"
              : submissionState
                ? "border-pending"
                : ""),
        (mark === "hit" || mark === "sunk") &&
          "ring-2 ring-inset ring-destructive",
        mark === "miss" && "saturate-50",
        selected && "z-10 ring-2 ring-osrs-yellow ring-inset",
        highlighted && "ring-2 ring-destructive",
        tierLocked && "opacity-60 saturate-50",
        dimmed && !selected && "opacity-30 saturate-50"
      )}
    >
      {!tile.isHidden && (
        <>
          {tile.headerImage ? (
            <Image
              unoptimized
              src={tile.headerImage || getRandomFrog()}
              alt=""
              fill
              sizes="120px"
              className={cn(
                "object-contain",
                completion === "completed"
                  ? "brightness-110"
                  : submissionState
                    ? ""
                    : "opacity-80 grayscale group-hover:opacity-100 group-hover:grayscale-0"
              )}
            />
          ) : (
            <div
              className={cn(
                "flex h-full w-full items-center justify-center",
                completion === "completed"
                  ? "bg-success/30"
                  : submissionState === "needs_review"
                    ? "bg-warning/25"
                    : submissionState
                      ? "bg-pending/25"
                      : "bg-secondary"
              )}
            >
              <span className="osrs-text-shadow osrs-tile-text line-clamp-3 px-[6%] text-center font-display leading-tight font-semibold text-osrs-gold @max-[43px]/tile:hidden">
                {tile.title}
              </span>
            </div>
          )}

          {/* Completed check (bottom-right, inventory style) */}
          {completion === "completed" && (
            <div
              className="absolute right-[4%] bottom-[4%] z-10 flex size-[max(12px,22cqw)] items-center justify-center rounded-sm border border-black bg-success text-success-foreground shadow-sm"
              title="Completed"
            >
              <CheckCircle2 className="size-[75%]" aria-hidden="true" />
            </div>
          )}
          {submissionState === "needs_review" && completion !== "completed" && (
            <div
              className="absolute top-[4%] right-[4%] z-10 flex size-[max(12px,22cqw)] items-center justify-center rounded-sm border border-black bg-warning text-warning-foreground shadow-sm"
              title="Changes requested"
            >
              <span className="osrs-tile-text leading-none font-bold">!</span>
            </div>
          )}
          {submissionState === "pending" && completion !== "completed" && (
            <div
              className="absolute top-[4%] right-[4%] z-10 flex size-[max(12px,22cqw)] items-center justify-center rounded-sm border border-black bg-pending text-pending-foreground shadow-sm"
              title="Pending review"
            >
              <Clock className="size-[70%]" aria-hidden="true" />
            </div>
          )}

          {/* Battleship result (bottom-left; top-left is the XP number) */}
          {mark && (
            <BattleshipMarkBadge
              mark={mark}
              labelled
              className="absolute bottom-[4%] left-[4%] z-10 size-[max(12px,22cqw)]"
            />
          )}

          {/* XP shown like an item quantity; dropped on very small slots */}
          <span className="osrs-qty osrs-tile-text absolute top-[5%] left-[6%] z-10 @max-[43px]/tile:hidden">
            {tile.weight}
          </span>

          {tierLocked && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/40">
              <Lock
                className="size-[35%] text-osrs-gold drop-shadow"
                aria-hidden="true"
              />
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80">
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          )}
        </>
      )}
      {tile.isHidden && (
        <div className="osrs-tile-text absolute inset-0 flex items-center justify-center p-1 text-center text-muted-foreground @max-[43px]/tile:hidden">
          {canToggleReveal ? "Click to reveal" : "Hidden"}
        </div>
      )}
    </div>
  )
})
