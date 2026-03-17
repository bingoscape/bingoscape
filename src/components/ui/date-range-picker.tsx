"use client"

import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  value?: DateRange
  onChange: (range: DateRange | undefined) => void
  placeholder?: string
  fromDate?: Date
  toDate?: Date
  disabled?: boolean
  className?: string
  error?: string
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  fromDate,
  toDate,
  disabled,
  className,
  error,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(undefined)
  }

  const displayText = React.useMemo(() => {
    if (!value?.from) return placeholder

    if (!value.to) {
      return format(value.from, "PPP")
    }

    return `${format(value.from, "PPP")} → ${format(value.to, "PPP")}`
  }, [value, placeholder])

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value?.from && "text-muted-foreground",
              error && "border-destructive focus-visible:ring-destructive"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="flex-1 truncate">{displayText}</span>
            {value?.from && !disabled && (
              <X
                className="ml-2 h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={value}
            onSelect={(range) => {
              onChange(range)
              // Close popover when both dates are selected
              if (range?.from && range?.to) {
                setOpen(false)
              }
            }}
            numberOfMonths={2}
            fromDate={fromDate}
            toDate={toDate}
            defaultMonth={value?.from}
          />
        </PopoverContent>
      </Popover>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  )
}
