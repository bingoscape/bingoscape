"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import React from "react"

export interface TimePickerInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> {
  picker: "12hours" | "hours" | "minutes" | "seconds"
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  period?: "AM" | "PM"
  onRightFocus?: () => void
  onLeftFocus?: () => void
}

export const TimePickerInput = React.forwardRef<
  HTMLInputElement,
  TimePickerInputProps
>(
  (
    {
      className,
      type = "tel",
      date,
      setDate,
      picker,
      period,
      onLeftFocus,
      onRightFocus,
      ...props
    },
    ref
  ) => {
    const [value, setValue] = React.useState<string>(() => {
      if (!date) return ""
      if (picker === "12hours") {
        let h = date.getHours()
        if (h === 0) h = 12
        if (h > 12) h -= 12
        return h.toString().padStart(2, "0")
      }
      if (picker === "hours") {
        return date.getHours().toString().padStart(2, "0")
      }
      if (picker === "minutes") {
        return date.getMinutes().toString().padStart(2, "0")
      }
      if (picker === "seconds") {
        return date.getSeconds().toString().padStart(2, "0")
      }
      return ""
    })

    React.useEffect(() => {
      if (!date) {
        setValue("")
        return
      }
      if (picker === "12hours") {
        let h = date.getHours()
        if (h === 0) h = 12
        if (h > 12) h -= 12
        setValue(h.toString().padStart(2, "0"))
      } else if (picker === "hours") {
        setValue(date.getHours().toString().padStart(2, "0"))
      } else if (picker === "minutes") {
        setValue(date.getMinutes().toString().padStart(2, "0"))
      } else if (picker === "seconds") {
        setValue(date.getSeconds().toString().padStart(2, "0"))
      }
    }, [date, picker])

    const calculateNewValue = (key: string) => {
      if (key === "ArrowUp") return 1
      if (key === "ArrowDown") return -1
      return 0
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab") return
      if (e.key === "ArrowRight") {
        onRightFocus?.()
        return
      }
      if (e.key === "ArrowLeft") {
        onLeftFocus?.()
        return
      }
      if (["ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault()
        const step = calculateNewValue(e.key)
        const d = date ? new Date(date) : new Date()
        if (picker === "12hours") {
          let h = d.getHours()
          h += step
          if (h < 0) h = 23
          if (h > 23) h = 0
          d.setHours(h)
        } else if (picker === "hours") {
          d.setHours((d.getHours() + step + 24) % 24)
        } else if (picker === "minutes") {
          d.setMinutes((d.getMinutes() + step + 60) % 60)
        } else if (picker === "seconds") {
          d.setSeconds((d.getSeconds() + step + 60) % 60)
        }
        setDate(d)
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault()
      let newValue = e.target.value.replace(/\D/g, "")
      if (newValue.length > 2) newValue = newValue.slice(newValue.length - 2)
      setValue(newValue)

      if (newValue.length === 2) {
        let parsed = parseInt(newValue, 10)
        if (isNaN(parsed)) return

        const d = date ? new Date(date) : new Date()

        if (picker === "12hours") {
          if (parsed > 12) parsed = 12
          if (parsed < 1) parsed = 1
          if (period === "PM" && parsed < 12) parsed += 12
          if (period === "AM" && parsed === 12) parsed = 0
          d.setHours(parsed)
        } else if (picker === "hours") {
          if (parsed > 23) parsed = 23
          d.setHours(parsed)
        } else if (picker === "minutes") {
          if (parsed > 59) parsed = 59
          d.setMinutes(parsed)
        } else if (picker === "seconds") {
          if (parsed > 59) parsed = 59
          d.setSeconds(parsed)
        }
        setDate(d)
        if (onRightFocus) onRightFocus()
      }
    }

    return (
      <Input
        ref={ref}
        id={picker}
        name={picker}
        className={cn(
          "w-[48px] text-center font-mono text-base tabular-nums caret-transparent focus:bg-accent focus:text-accent-foreground",
          className
        )}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        inputMode="decimal"
        {...props}
      />
    )
  }
)

TimePickerInput.displayName = "TimePickerInput"
