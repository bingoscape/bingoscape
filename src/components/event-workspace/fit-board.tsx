"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface FitBoardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns (unitless). */
  cols: number
  /** Effective number of rows (unitless; fractional for tier ladders). */
  rows: number
  /** Vertical gap count; defaults to rows - 1 (plain grid). */
  vgaps?: number
  /** Extra classes for the size-container pane around the board. */
  paneClassName?: string
}

/**
 * Size container + board frame for the fit-to-viewport layout.
 *
 * The pane (`.osrs-board-pane`) is the container whose inline and block size
 * the CSS in globals.css measures; the board (`.osrs-board-fit`) derives the
 * slot size `--s` from the `--cols`/`--rows` custom properties set here and
 * centres itself. Children are the Tile slots (grid items).
 */
export const FitBoard = React.forwardRef<HTMLDivElement, FitBoardProps>(
  function FitBoard(
    { cols, rows, vgaps, className, paneClassName, style, children, ...rest },
    ref
  ) {
    const vars = {
      "--cols": cols,
      "--rows": rows,
      ...(vgaps !== undefined ? { "--vgaps": vgaps } : {}),
      ...style,
    } as React.CSSProperties

    return (
      <div className={cn("osrs-board-pane", paneClassName)}>
        <div
          ref={ref}
          className={cn("osrs-board-fit osrs-panel-inset rounded-sm", className)}
          style={vars}
          {...rest}
        >
          {children}
        </div>
      </div>
    )
  }
)
