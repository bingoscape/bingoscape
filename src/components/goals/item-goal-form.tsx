"use client"

import { ItemPicker } from "./item-picker"
import type { SelectedItem } from "./types"

interface ItemGoalFormProps {
  selectedItems: SelectedItem[]
  onSelectedItemsChange: (items: SelectedItem[]) => void
  /** Focus the item search on mount. */
  autoFocus?: boolean
}

export function ItemGoalForm({
  selectedItems,
  onSelectedItemsChange,
  autoFocus = true,
}: ItemGoalFormProps) {
  return (
    <div className="space-y-3">
      <ItemPicker
        value={selectedItems}
        onChange={onSelectedItemsChange}
        autoFocus={autoFocus}
      />
      <p className="text-muted-foreground text-xs">
        Each item becomes its own goal. The quantity is how many of that item
        must be obtained. In a SUM group, this target is illustrative and does
        not cap contributions.
      </p>
    </div>
  )
}
