"use client"

import Image from "next/image"
import { BarChart2, Package, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatNumber } from "@/lib/number-input"
import { METRIC_GOAL_LABEL, getMetricTargetCopy } from "@/lib/osrs-metrics"
import { cn } from "@/lib/utils"

interface GoalRowContentProps {
  description: string
  targetValue: number
  /** Set for an item Goal: the icon and base name shown before the description. */
  item?: { imageUrl: string; baseName: string } | null
  /** Set for an XP / Kills Goal: picks the badge ("XP", "Kills", "Activity"). */
  metric?: { metricType: string } | null
  /** Softer text, for a Goal that is not saved yet. */
  muted?: boolean
}

/**
 * The inside of a Goal row: kind icon and badge, description and target.
 * A fragment, so the caller decides the wrapping element.
 */
export function GoalRowContent({
  description,
  targetValue,
  item,
  metric,
  muted = false,
}: GoalRowContentProps) {
  return (
    <>
      {item ? (
        <>
          <Image
            src={item.imageUrl}
            alt={item.baseName}
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 object-contain"
          />
          <Badge variant="secondary" className="shrink-0 text-xs">
            <Package className="mr-1 h-3 w-3" />
            Item
          </Badge>
        </>
      ) : metric ? (
        <>
          <BarChart2
            aria-hidden="true"
            className="text-info h-4 w-4 shrink-0"
          />
          <Badge
            variant="secondary"
            className="shrink-0 text-xs"
            title={METRIC_GOAL_LABEL}
          >
            {getMetricTargetCopy(metric.metricType).badge}
          </Badge>
        </>
      ) : (
        <Target aria-hidden="true" className="text-success h-4 w-4 shrink-0" />
      )}
      <span
        className={cn(
          "min-w-0 text-sm wrap-anywhere",
          muted && "text-muted-foreground"
        )}
      >
        {description}
      </span>
      <Badge variant="outline" className="shrink-0 text-xs">
        Target: {formatNumber(targetValue)}
      </Badge>
    </>
  )
}
