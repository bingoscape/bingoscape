"use client"

import { getItemDisplayName } from "@/components/osrs-item-option"
import { formatNumber, parseTargetInput } from "@/lib/number-input"
import { CombineChoice } from "./combine-choice"
import {
  MIN_ITEMS_TO_COMBINE,
  planCombine,
  type CombineState,
} from "./combine-options"
import { ItemPicker } from "./item-picker"
import type { SelectedItem } from "./types"

interface ItemGoalFormProps {
  selectedItems: SelectedItem[]
  onSelectedItemsChange: (items: SelectedItem[]) => void
  /** How several items count; shown once two or more are selected. */
  combine: CombineState
  onCombineChange: (combine: CombineState) => void
  /** The goals go into an existing group instead of the top level of the tile. */
  nested: boolean
  /** Focus the item search on mount. */
  autoFocus?: boolean
}

/** "Abyssal whip", or "Dragon bones x100" for a quantity above one. */
function previewName({ item, quantity }: SelectedItem): string {
  const name = getItemDisplayName(item)
  const target = parseTargetInput(quantity)
  return target !== null && target > 1
    ? `${name} x${formatNumber(target)}`
    : name
}

export function ItemGoalForm({
  selectedItems,
  onSelectedItemsChange,
  combine,
  onCombineChange,
  nested,
  autoFocus = true,
}: ItemGoalFormProps) {
  return (
    <div className="space-y-4">
      <ItemPicker
        value={selectedItems}
        onChange={onSelectedItemsChange}
        autoFocus={autoFocus}
      />
      {selectedItems.length >= MIN_ITEMS_TO_COMBINE && (
        <CombineChoice
          state={combine}
          onChange={onCombineChange}
          plan={planCombine(combine, selectedItems.length)}
          names={selectedItems.map(previewName)}
          nested={nested}
        />
      )}
      <p className="text-muted-foreground text-xs">
        The quantity is how many of that item must be obtained. In a SUM group,
        this target is illustrative and does not cap contributions.
      </p>
    </div>
  )
}
