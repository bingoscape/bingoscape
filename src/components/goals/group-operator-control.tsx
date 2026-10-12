"use client"

import { CheckCheck, Plus, Shuffle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { GroupOperator } from "./types"

interface GroupOperatorControlProps {
  operator: GroupOperator
  /** Editors get a select, everyone else a read-only badge. */
  hasSufficientRights: boolean
  onChange: (operator: GroupOperator) => void
}

export function GroupOperatorControl({
  operator,
  hasSufficientRights,
  onChange,
}: GroupOperatorControlProps) {
  if (hasSufficientRights) {
    return (
      <Select
        value={operator}
        onValueChange={(v) => onChange(v as GroupOperator)}
      >
        <SelectTrigger
          aria-label={`Group logic: ${operator}`}
          className="h-7 w-auto min-w-[70px] gap-1.5 px-2 pointer-coarse:min-h-11 [&>span]:hidden"
        >
          <div className="flex items-center gap-1 text-[10px] font-medium">
            {operator === "AND" && <><CheckCheck className="h-3 w-3 text-info" /> AND</>}
            {operator === "OR" && <><Shuffle className="h-3 w-3 text-chart-5" /> OR</>}
            {operator === "SUM" && <><Plus className="h-3 w-3 text-success" /> SUM</>}
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AND">
            <div className="flex flex-col">
              <span className="flex items-center gap-1"><CheckCheck className="h-3 w-3 text-info" /> AND</span>
              <span className="text-[10px] text-muted-foreground whitespace-normal max-w-[200px]">Require players to complete every item.</span>
            </div>
          </SelectItem>
          <SelectItem value="OR">
            <div className="flex flex-col">
              <span className="flex items-center gap-1"><Shuffle className="h-3 w-3 text-chart-5" /> OR</span>
              <span className="text-[10px] text-muted-foreground whitespace-normal max-w-[200px]">Give players a choice to complete a specific number of items.</span>
            </div>
          </SelectItem>
          <SelectItem value="SUM">
            <div className="flex flex-col">
              <span className="flex items-center gap-1"><Plus className="h-3 w-3 text-success" /> SUM</span>
              <span className="text-[10px] text-muted-foreground whitespace-normal max-w-[200px]">Pool raw progress from all items together.</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    )
  }

  return (
    <Badge
      variant={
        operator === "AND"
          ? "default"
          : operator === "OR"
            ? "secondary"
            : "outline"
      }
      className={cn(
        "h-5 px-1.5 text-[10px] font-medium flex items-center gap-1 shrink-0",
        operator === "SUM" && "bg-success/10 text-success border-success"
      )}
    >
      {operator === "AND" && (
        <><CheckCheck className="h-3 w-3" /> AND</>
      )}
      {operator === "OR" && (
        <><Shuffle className="h-3 w-3" /> OR</>
      )}
      {operator === "SUM" && (
        <><Plus className="h-3 w-3" /> SUM</>
      )}
    </Badge>
  )
}
