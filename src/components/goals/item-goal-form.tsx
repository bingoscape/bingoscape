"use client"

import { Label } from "@/components/ui/label"
import { OsrsItemSearch } from "@/components/osrs-item-search"
import type { OsrsItem } from "@/types/osrs-items"
import { NumberField } from "./number-field"

interface ItemGoalFormProps {
  selectedItems: OsrsItem[]
  onSelectedItemsChange: (items: OsrsItem[]) => void
  /** Raw text of the quantity field. */
  targetValue: string
  onTargetValueChange: (raw: string) => void
  /** Focus the first field on mount. */
  autoFocus?: boolean
}

export function ItemGoalForm({
  selectedItems,
  onSelectedItemsChange,
  targetValue,
  onTargetValueChange,
  autoFocus = true,
}: ItemGoalFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Items</Label>
        <OsrsItemSearch
          onItemSelect={(items) => {
            if (Array.isArray(items)) {
              onSelectedItemsChange(items)
            } else {
              onSelectedItemsChange([items])
            }
          }}
          selectedItems={selectedItems}
          placeholder="Search for items..."
          multiSelect={true}
          autoFocus={autoFocus}
        />
        {selectedItems.length > 0 && (
          <p className="mt-2 text-xs font-medium text-primary">
            {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""}{" "}
            selected
            <span className="font-normal text-muted-foreground">
              {" "}
              - a separate goal will be created for each item
            </span>
          </p>
        )}
      </div>
      <NumberField
        id="tree-itemTargetValue"
        label="Quantity per item"
        value={targetValue}
        onValueChange={onTargetValueChange}
        placeholder="1"
        hint="How many times each item must be obtained. In a SUM group, this target is illustrative and does not cap contributions."
      />
    </div>
  )
}
