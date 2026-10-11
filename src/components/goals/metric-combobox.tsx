"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { BarChart2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  getMetricIds,
  getMetricName,
  getMetricTargetCopy,
  getWikiIconUrl,
} from "@/lib/osrs-metrics"
import { cn } from "@/lib/utils"
import type { MetricType } from "./types"

interface MetricIconProps {
  metric: string
}

/** The metric's wiki icon in a slot frame; a neutral glyph stands in when the wiki has no image. */
function MetricIcon({ metric }: MetricIconProps) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="osrs-slot relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm">
      {failed ? (
        <BarChart2
          aria-hidden="true"
          className="text-muted-foreground h-4 w-4"
        />
      ) : (
        <Image
          fill
          src={getWikiIconUrl(metric)}
          alt=""
          sizes="28px"
          className="object-contain p-0.5"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}

interface MetricComboboxProps {
  /** Which list to search: bosses or activities. */
  metricType: Exclude<MetricType, "skill">
  /** The selected metric's Wise Old Man id, or "" when none is selected. */
  value: string
  onValueChange: (metric: string) => void
  /** Focus the search field on mount. */
  autoFocus?: boolean
}

/**
 * Searchable list of bosses or activities, rendered inline (no popover, so it
 * behaves inside a drawer: no focus trap within the focus trap, and it scrolls
 * with the touch). Once one is picked the list collapses to the choice with a
 * Change button.
 */
export function MetricCombobox({
  metricType,
  value,
  onValueChange,
  autoFocus = false,
}: MetricComboboxProps) {
  const copy = getMetricTargetCopy(metricType)
  const noun = copy.nameLabel.toLowerCase()
  const nounPlural = metricType === "boss" ? "bosses" : "activities"
  const [changing, setChanging] = useState(false)
  const [search, setSearch] = useState("")
  const changeButtonRef = useRef<HTMLButtonElement>(null)
  // Set when a pick collapses the list, so focus can move to the Change button.
  const focusChangeButton = useRef(false)

  useEffect(() => {
    if (!changing && focusChangeButton.current) {
      focusChangeButton.current = false
      changeButtonRef.current?.focus()
    }
  }, [changing, value])

  const showList = !value || changing

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{copy.nameLabel}</p>
        {value && changing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => {
              focusChangeButton.current = true
              setChanging(false)
            }}
          >
            Cancel
          </Button>
        )}
      </div>

      {showList ? (
        <Command
          loop
          label={`Search ${nounPlural}`}
          className="bg-field ring-offset-background focus-within:ring-ring border focus-within:ring-2 focus-within:ring-offset-1"
        >
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={`Search ${nounPlural}...`}
            autoFocus={autoFocus || changing}
            autoComplete="off"
            enterKeyHint="done"
            // The drawer reads this to let Escape clear the text instead of closing.
            data-escape-clears=""
            onKeyDown={(event) => {
              if (event.key === "Escape" && search !== "") setSearch("")
            }}
          />
          <CommandList className="max-h-[min(16rem,40dvh)]">
            <CommandEmpty>{`No ${noun} found.`}</CommandEmpty>
            <CommandGroup className="p-1">
              {getMetricIds(metricType).map((metric) => (
                <CommandItem
                  key={metric}
                  value={metric}
                  keywords={[getMetricName(metric)]}
                  onSelect={() => {
                    focusChangeButton.current = true
                    setChanging(false)
                    setSearch("")
                    onValueChange(metric)
                  }}
                  className={cn(
                    "cursor-pointer gap-3",
                    metric === value && "bg-primary/10"
                  )}
                >
                  <MetricIcon metric={metric} />
                  <span className="min-w-0 flex-1 truncate">
                    {getMetricName(metric)}
                  </span>
                  {metric === value && (
                    <>
                      <Check aria-hidden="true" className="text-success" />
                      <span className="sr-only">Selected</span>
                    </>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      ) : (
        <div className="bg-muted/40 flex items-center gap-3 rounded-md border p-2">
          <MetricIcon metric={value} />
          <p className="min-w-0 flex-1 truncate font-medium">
            {getMetricName(value)}
          </p>
          <Button
            ref={changeButtonRef}
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Change ${noun}: ${getMetricName(value)}`}
            onClick={() => {
              setSearch("")
              setChanging(true)
            }}
          >
            Change
          </Button>
        </div>
      )}
    </div>
  )
}
