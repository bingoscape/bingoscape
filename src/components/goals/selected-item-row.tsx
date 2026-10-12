"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getItemDisplayName, ItemIcon } from "@/components/osrs-item-option"
import { NumberField } from "./number-field"
import type { SelectedItem } from "./types"
import { resolveItemId } from "./utils"

interface SelectedItemRowProps {
  entry: SelectedItem
  onQuantityChange: (raw: string) => void
  onRemove: () => void
}

/**
 * One picked item: icon, name, its own quantity (typed, shorthand or stepped
 * with - / +) and a remove button. On a narrow screen the quantity moves to a
 * second line so the name keeps its room.
 */
export function SelectedItemRow({
  entry,
  onQuantityChange,
  onRemove,
}: SelectedItemRowProps) {
  const { item, quantity } = entry
  const name = getItemDisplayName(item)

  return (
    <li className="bg-card grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 rounded-md border p-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
      <ItemIcon item={item} />
      <span
        className="flex min-h-9 min-w-0 items-center text-sm font-medium"
        title={name}
      >
        <span className="truncate">{name}</span>
      </span>
      <NumberField
        id={`selected-item-quantity-${resolveItemId(item)}`}
        label={`Quantity of ${name}`}
        hideLabel
        compact
        value={quantity}
        onValueChange={onQuantityChange}
        placeholder="1"
        stepper={{
          decreaseLabel: `Decrease quantity of ${name}`,
          increaseLabel: `Increase quantity of ${name}`,
        }}
        className="col-span-2 col-start-2 row-start-2 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:w-44"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className="col-start-3 row-start-1 h-8 w-8 sm:col-start-4"
      >
        <X aria-hidden="true" />
      </Button>
    </li>
  )
}
