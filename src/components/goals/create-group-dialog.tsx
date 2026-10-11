"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { createGoalGroup } from "@/app/actions/goal-groups"
import type { GroupOperator } from "./types"

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tileId: string
  /** Group the new group is nested in; null creates it at the top level. */
  parentGroupId: string | null
  onRefresh: () => void
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  tileId,
  parentGroupId,
  onRefresh,
}: CreateGroupDialogProps) {
  const [operator, setOperator] = useState<GroupOperator>("AND")
  const [minRequired, setMinRequired] = useState<number>(1)

  const handleCreateGroup = async () => {
    const result = await createGoalGroup(
      tileId,
      operator,
      parentGroupId,
      minRequired
    )
    if (result.success) {
      toast({
        title: "Group created",
        description: "Goal group has been created successfully.",
      })
      onOpenChange(false)
      setOperator("AND")
      setMinRequired(1)
      onRefresh()
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to create group",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Goal Group</DialogTitle>
          <DialogDescription>
            Group goals together with logical operators (AND/OR) to control
            tile completion.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="operator">Logical Operator</Label>
            <Select
              value={operator}
              onValueChange={(v) => {
                setOperator(v as GroupOperator)
                if (v === "AND") {
                  setMinRequired(1) // Reset to 1 when switching to AND
                }
              }}
            >
              <SelectTrigger id="operator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND (all required)</SelectItem>
                <SelectItem value="OR">OR (min required)</SelectItem>
                <SelectItem value="SUM">SUM (pooled progress)</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {operator === "AND"
                ? "All goals in this group must be completed"
                : operator === "SUM"
                  ? "Progress from all goals is pooled"
                  : `At least ${minRequired} goal${minRequired !== 1 ? "s" : ""} in this group must be completed`}
            </p>
          </div>
          {(operator === "OR" || operator === "SUM") && (
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Label className="shrink-0 text-xs">
                  {operator === "SUM" ? "Target Sum:" : "Min Goals Required:"}
                </Label>
                <Input
                  type="number"
                  min="1"
                  className="h-8 w-20"
                  value={minRequired}
                  onChange={(e) =>
                    setMinRequired(
                      Math.max(1, Number.parseInt(e.target.value) || 1)
                    )
                  }
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {operator === "SUM"
                  ? "The total numerical progress required across all children"
                  : "How many goals must be completed for this OR group to be satisfied"}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateGroup}>Create Group</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
