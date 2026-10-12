"use client"

import { AlertCircle, HelpCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getItemDisplayName, ItemIcon } from "@/components/osrs-item-option"
import { cn } from "@/lib/utils"
import type { OsrsItem } from "@/types/osrs-items"
import { NumberField } from "./number-field"
import { itemKey, resolveItemId } from "./utils"

/** One line of a pasted list while it is reviewed. */
export interface PasteRow {
  id: number
  /** What the list said, shown so the person can compare it with the match. */
  raw: string
  /** The reading that was looked up; "Search instead" searches for it. */
  name: string
  /** The raw text of the quantity, edited like a selected item's. */
  quantity: string
  /** The matched or chosen item; null while an ambiguous row waits for a choice. */
  item: OsrsItem | null
  /** The items to choose from; empty for a matched row or one that was not found. */
  candidates: OsrsItem[]
}

/** Where a row stands: usable as it is, waiting for a choice, or without a match. */
export function rowState(row: PasteRow): "ready" | "choose" | "notFound" {
  if (row.item) return "ready"
  return row.candidates.length > 0 ? "choose" : "notFound"
}

interface PasteReviewRowProps {
  row: PasteRow
  onQuantityChange: (raw: string) => void
  onChoose: (item: OsrsItem) => void
  onRemove: () => void
  onSearchInstead: () => void
}

/** Label of a candidate; items that read the same get their id to tell them apart. */
function candidateLabels(candidates: OsrsItem[]): Map<string, string> {
  const names = candidates.map((candidate) => getItemDisplayName(candidate))
  return new Map(
    candidates.map((candidate, index) => {
      const name = names[index] ?? ""
      const shared = names.filter((other) => other === name).length > 1
      return [
        itemKey(candidate),
        shared ? `${name} (id ${resolveItemId(candidate)})` : name,
      ]
    })
  )
}

/**
 * A reviewed line: the matched item with an editable quantity, a choice among
 * candidates (a native select: compact, and the phone shows its own picker),
 * or a line that was not found, with the ways out.
 */
export function PasteReviewRow({
  row,
  onQuantityChange,
  onChoose,
  onRemove,
  onSearchInstead,
}: PasteReviewRowProps) {
  const state = rowState(row)
  const title = row.item ? getItemDisplayName(row.item) : row.raw
  const labels = candidateLabels(row.candidates)

  return (
    <li
      className={cn(
        "bg-card grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 rounded-md border p-2",
        state === "choose" && "border-warning/60",
        state === "notFound" && "border-danger/50"
      )}
    >
      {row.item ? (
        <ItemIcon item={row.item} />
      ) : (
        <span
          aria-hidden="true"
          className="osrs-slot text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-sm"
        >
          {state === "choose" ? (
            <HelpCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="text-danger h-5 w-5" />
          )}
        </span>
      )}

      <div className="flex min-h-9 min-w-0 flex-col justify-center">
        <span className="text-sm font-medium wrap-anywhere" title={title}>
          {state === "ready" ? title : `“${row.raw}”`}
        </span>
        {state === "choose" && (
          <span className="text-warning text-xs font-medium">
            Choose one: this fits several items
          </span>
        )}
        {state === "notFound" && (
          <span className="text-danger text-xs font-medium">Not found</span>
        )}
        {state === "ready" && row.raw !== title && (
          <span className="text-muted-foreground text-xs wrap-anywhere">
            from “{row.raw}”
          </span>
        )}
      </div>

      {state !== "notFound" && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove ${title} from the list`}
          onClick={onRemove}
          className="h-8 w-8"
        >
          <X aria-hidden="true" />
        </Button>
      )}

      {state === "notFound" ? (
        <div className="col-span-2 col-start-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSearchInstead}
          >
            Search instead
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove “${row.raw}” from the list`}
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      ) : (
        <div className="col-span-2 col-start-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          {row.candidates.length > 0 && (
            <select
              aria-label={`Choose an item for “${row.raw}”`}
              value={row.item ? itemKey(row.item) : ""}
              onChange={(event) => {
                const picked = row.candidates.find(
                  (candidate) => itemKey(candidate) === event.target.value
                )
                if (picked) onChoose(picked)
              }}
              className={cn(
                "osrs-panel-inset ring-offset-background focus-visible:ring-ring h-9 min-w-0 flex-1 rounded-sm px-2 text-base focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden pointer-coarse:min-h-11 md:pointer-fine:text-sm",
                state === "choose" && "border-warning border"
              )}
            >
              <option value="" disabled>
                Choose one...
              </option>
              {row.candidates.map((candidate) => (
                <option key={itemKey(candidate)} value={itemKey(candidate)}>
                  {labels.get(itemKey(candidate))}
                </option>
              ))}
            </select>
          )}
          <NumberField
            id={`paste-quantity-${row.id}`}
            label={`Pasted quantity of ${title}`}
            hideLabel
            compact
            value={row.quantity}
            onValueChange={onQuantityChange}
            placeholder="1"
            stepper={{
              decreaseLabel: `Decrease pasted quantity of ${title}`,
              increaseLabel: `Increase pasted quantity of ${title}`,
            }}
            className="sm:w-44"
          />
        </div>
      )}
    </li>
  )
}
