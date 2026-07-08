"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { Label } from "@/components/ui/label"
import { TimePickerInput } from "./time-picker-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TimePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
}

export function TimePicker({ date, setDate }: TimePickerProps) {
  const minuteRef = React.useRef<HTMLInputElement>(null)
  const hourRef = React.useRef<HTMLInputElement>(null)

  const period = React.useMemo(() => {
    if (!date) return "AM"
    return date.getHours() >= 12 ? "PM" : "AM"
  }, [date])

  const setPeriod = (newPeriod: "AM" | "PM") => {
    if (!date) {
      const d = new Date()
      d.setHours(newPeriod === "PM" ? 12 : 0)
      d.setMinutes(0)
      d.setSeconds(0)
      setDate(d)
      return
    }
    const d = new Date(date)
    const h = d.getHours()
    if (newPeriod === "PM" && h < 12) {
      d.setHours(h + 12)
    } else if (newPeriod === "AM" && h >= 12) {
      d.setHours(h - 12)
    }
    setDate(d)
  }

  return (
    <div className="flex items-end gap-2">
      <div className="grid gap-1 text-center">
        <Label htmlFor="hours" className="text-xs text-muted-foreground">
          Hours
        </Label>
        <TimePickerInput
          picker="12hours"
          period={period}
          date={date}
          setDate={setDate}
          ref={hourRef}
          onRightFocus={() => minuteRef.current?.focus()}
        />
      </div>
      <div className="grid gap-1 text-center">
        <Label htmlFor="minutes" className="text-xs text-muted-foreground">
          Minutes
        </Label>
        <TimePickerInput
          picker="minutes"
          date={date}
          setDate={setDate}
          ref={minuteRef}
          onLeftFocus={() => hourRef.current?.focus()}
        />
      </div>
      <div className="grid gap-1 text-center">
        <Label htmlFor="period" className="text-xs text-muted-foreground">
          AM/PM
        </Label>
        <Select
          value={period}
          onValueChange={(val: "AM" | "PM") => setPeriod(val)}
        >
          <SelectTrigger className="w-[65px] focus:bg-accent focus:text-accent-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex h-10 items-center justify-center">
        <Clock className="ml-2 h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  )
}
