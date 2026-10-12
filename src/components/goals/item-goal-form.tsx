"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OsrsItemSearch } from "@/components/osrs-item-search"
import type { OsrsItem } from "@/types/osrs-items"

interface ItemGoalFormProps {
  selectedItems: OsrsItem[]
  onSelectedItemsChange: (items: OsrsItem[]) => void
  targetValue: number
  onTargetValueChange: (value: number) => void
}

export function ItemGoalForm({
  selectedItems,
  onSelectedItemsChange,
  targetValue,
  onTargetValueChange,
}: ItemGoalFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Select OSRS Items
        </Label>
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
        />
        {selectedItems.length > 0 && (
          <p className="text-xs font-medium text-primary mt-2">
            {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} selected
            <span className="text-muted-foreground font-normal"> - a separate goal will be created for each item</span>
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="tree-itemTargetValue" className="text-sm font-medium">
          Quantity Required per Item
        </Label>
        <Input
          id="tree-itemTargetValue"
          type="number"
          value={targetValue}
          onChange={(e) =>
            onTargetValueChange(Number.parseInt(e.target.value) || 1)
          }
          placeholder="1"
          min="1"
        />
        <div className="mt-2 rounded-md bg-muted/50 p-3 border text-xs text-muted-foreground">
          <strong>Note:</strong> Number of times this item must be obtained. In a SUM group, this target is illustrative and does not cap contributions.
        </div>
      </div>
    </div>
  )
}
