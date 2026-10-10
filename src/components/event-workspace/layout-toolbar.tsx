"use client"

import { useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, MinusSquare, PlusSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { addRowOrColumn, deleteRowOrColumn } from "@/app/actions/bingo"
import type { Tile } from "@/types/model"

interface LayoutToolbarProps {
  bingoId: string
  tiles: Tile[]
  columns: number
  /** Indices of the Tiles that the pending row/column delete would remove. */
  onHighlight: (indices: number[]) => void
  onDone: () => void
}

type Axis = "row" | "column"

/**
 * "Edit layout" toolbar: add or remove the last row/column. Dragging Tiles to
 * swap them and revealing hidden placeholders happen on the Board itself.
 */
export function LayoutToolbar({
  bingoId,
  tiles,
  columns,
  onHighlight,
  onDone,
}: LayoutToolbarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const run = useCallback(
    async (kind: "add" | "delete", axis: Axis) => {
      try {
        const result =
          kind === "add"
            ? await addRowOrColumn(bingoId, axis)
            : await deleteRowOrColumn(bingoId, axis)
        if (!result.success) throw new Error(result.error)
        onHighlight([])
        toast({
          title: `${axis === "row" ? "Row" : "Column"} ${kind === "add" ? "added" : "deleted"}`,
          description:
            kind === "add"
              ? `A new ${axis} has been added to the bingo board.`
              : `The last ${axis} has been deleted from the bingo board.`,
        })
        startTransition(() => router.refresh())
      } catch (error) {
        console.error(`Error ${kind} ${axis}:`, error)
        toast({
          title: "Error",
          description: `Failed to ${kind === "add" ? "add" : "delete"} ${axis}`,
          variant: "destructive",
        })
      }
    },
    [bingoId, onHighlight, router]
  )

  const highlight = useCallback(
    (axis: Axis) => {
      const doomed =
        axis === "row"
          ? tiles.slice(-columns)
          : tiles.filter((_, index) => (index + 1) % columns === 0)
      onHighlight(doomed.map((tile) => tile.index))
    },
    [tiles, columns, onHighlight]
  )

  return (
    <div
      role="toolbar"
      aria-label="Edit layout"
      className="osrs-panel-inset flex flex-wrap items-center gap-2 rounded-sm px-2 py-1.5 text-xs"
    >
      <span className="mr-auto text-muted-foreground">
        Editing layout: drag Tiles to swap, click a placeholder to reveal it.
      </span>
      {(["row", "column"] as const).map((axis) => (
        <span key={axis} className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2"
            disabled={isPending}
            onClick={() => void run("add", axis)}
          >
            <PlusSquare aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
            {axis === "row" ? "Row" : "Column"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2"
            disabled={isPending}
            onClick={() => void run("delete", axis)}
            onMouseEnter={() => highlight(axis)}
            onFocus={() => highlight(axis)}
            onMouseLeave={() => onHighlight([])}
            onBlur={() => onHighlight([])}
          >
            <MinusSquare aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
            {axis === "row" ? "Row" : "Column"}
          </Button>
        </span>
      ))}
      <Button size="sm" className="h-7 px-2" onClick={onDone}>
        <Check aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
        Done
      </Button>
    </div>
  )
}
