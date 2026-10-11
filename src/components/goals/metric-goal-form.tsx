"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MetricSelectItems } from "./metric-select-items"
import type { MetricType } from "./types"

interface MetricGoalFormProps {
  metricType: MetricType
  onMetricTypeChange: (type: MetricType) => void
  metricName: string
  onMetricNameChange: (name: string) => void
  targetValue: number
  onTargetValueChange: (value: number) => void
}

export function MetricGoalForm({
  metricType,
  onMetricTypeChange,
  metricName,
  onMetricNameChange,
  targetValue,
  onTargetValueChange,
}: MetricGoalFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Metric Type
          </Label>
          <Select
            value={metricType}
            onValueChange={(v) => onMetricTypeChange(v as MetricType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skill">Skill</SelectItem>
              <SelectItem value="boss">Boss</SelectItem>
              <SelectItem value="activity">Activity</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Target Value
          </Label>
          <Input
            type="number"
            value={targetValue}
            onChange={(e) =>
              onTargetValueChange(Number.parseInt(e.target.value) || 1)
            }
            placeholder="1"
            min="1"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Metric Name
        </Label>
        <Select value={metricName} onValueChange={onMetricNameChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select metric" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <MetricSelectItems metricType={metricType} />
          </SelectContent>
        </Select>
      </div>
      
      <div className="rounded-md bg-muted/50 p-3 border text-xs text-muted-foreground">
        <strong>Note:</strong> In a SUM group, this target is illustrative and does not cap contributions.
      </div>
    </div>
  )
}
