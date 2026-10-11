"use client"

import Image from "next/image"
import { SelectItem } from "@/components/ui/select"
import { getMetricIds, getMetricName, getWikiIconUrl } from "@/lib/osrs-metrics"

interface MetricSelectItemsProps {
  /** "skill", "boss" or "activity"; any other value renders no options. */
  metricType: string
}

/** Options for a metric-name `Select`: wiki icon plus display name per metric. */
export function MetricSelectItems({ metricType }: MetricSelectItemsProps) {
  const metrics = getMetricIds(metricType)

  return (
    <>
      {metrics.map((m) => (
        <SelectItem key={m} value={m}>
          <div className="flex items-center gap-2">
            <div className="relative h-4 w-4 shrink-0">
              <Image
                fill
                src={getWikiIconUrl(m)}
                alt={getMetricName(m)}
                className="object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                }}
              />
            </div>
            <span>{getMetricName(m)}</span>
          </div>
        </SelectItem>
      ))}
    </>
  )
}
