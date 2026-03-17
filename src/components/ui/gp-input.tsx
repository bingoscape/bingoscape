"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface GPInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  value: number
  onChange: (value: number) => void
  error?: string
}

export function GPInput({
  value,
  onChange,
  className,
  error,
  disabled,
  ...props
}: GPInputProps) {
  const [displayValue, setDisplayValue] = React.useState("")
  const [isFocused, setIsFocused] = React.useState(false)

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString("en-US")
  }

  // Parse formatted string to number
  const parseNumber = (str: string): number => {
    const cleaned = str.replace(/[^0-9]/g, "")
    return cleaned === "" ? 0 : parseInt(cleaned, 10)
  }

  // Update display value when prop value changes (only when not focused)
  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatNumber(value))
    }
  }, [value, isFocused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const numericValue = parseNumber(input)

    setDisplayValue(input)
    onChange(numericValue)
  }

  const handleFocus = () => {
    setIsFocused(true)
    // Show raw number when focused for easier editing
    setDisplayValue(value.toString())
  }

  const handleBlur = () => {
    setIsFocused(false)
    // Format with commas when blurred
    const numericValue = parseNumber(displayValue)
    onChange(numericValue)
    setDisplayValue(formatNumber(numericValue))
  }

  return (
    <div className="relative w-full">
      <Input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        className={cn(
          "pr-10",
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        {...props}
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <span className="text-sm text-muted-foreground">GP</span>
      </div>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  )
}
