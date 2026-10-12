"use client"

import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  formatNumberPreview,
  parseTargetInput,
  validateNumberInput,
} from "@/lib/number-input"

interface NumberFieldProps {
  id: string
  label: string
  /** The raw text of the field; the parent parses it with `@/lib/number-input`. */
  value: string
  onValueChange: (raw: string) => void
  /** Unit for the "= 500,000 XP" preview. */
  unit?: string
  /** Unit for a value of exactly 1 ("kill"); defaults to `unit`. */
  unitSingular?: string
  placeholder?: string
  /** Extra text under the field (e.g. what the target counts). */
  hint?: React.ReactNode
  /** Smaller label and input, for inline editing. */
  compact?: boolean
  autoFocus?: boolean
  className?: string
}

/**
 * Number input for goal targets. It keeps what the user typed as text, so
 * clearing the field does not snap back to a default, and understands
 * shorthand such as "500k", "2.5m" and "13,034,431". It shows what the text
 * means ("= 500,000 XP") and validates on blur: the error is announced via
 * `aria-invalid` / `aria-describedby`. The parent uses `validateNumberInput`
 * with the same text to block submitting.
 */
export function NumberField({
  id,
  label,
  value,
  onValueChange,
  unit,
  unitSingular,
  placeholder,
  hint,
  compact = false,
  autoFocus,
  className,
}: NumberFieldProps) {
  const [touched, setTouched] = useState(false)

  const error = validateNumberInput(value)
  const showError = touched && error !== null
  // "= 1" next to a typed "1" adds nothing; show the preview when it tells the
  // user something (shorthand, separators or a number of 1,000 or more).
  const parsedValue = parseTargetInput(value)
  const preview =
    parsedValue !== null &&
    (parsedValue >= 1000 || value.trim() !== String(parsedValue))
      ? formatNumberPreview(value, unit, unitSingular)
      : null

  const errorId = `${id}-error`
  const previewId = `${id}-preview`
  const hintId = `${id}-hint`
  const describedBy =
    [
      showError ? errorId : null,
      !showError && preview ? previewId : null,
      hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label
        htmlFor={id}
        className={compact ? "text-xs" : "text-sm font-medium"}
      >
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={() => setTouched(true)}
        onKeyDown={(e) => {
          // Enter submits the surrounding form; make a rejected value visible.
          if (e.key === "Enter") setTouched(true)
        }}
        aria-invalid={showError}
        aria-describedby={describedBy}
        className={cn(
          compact && "h-8 text-sm",
          showError && "border-danger focus-visible:ring-danger"
        )}
      />
      {showError ? (
        <p
          id={errorId}
          role="alert"
          className="text-danger flex items-start gap-1.5 text-xs"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-px h-3.5 w-3.5 shrink-0"
          />
          <span>{error}</span>
        </p>
      ) : (
        preview && (
          <p
            id={previewId}
            className="text-foreground text-xs font-medium tabular-nums"
          >
            {preview}
          </p>
        )
      )}
      {hint && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
    </div>
  )
}
