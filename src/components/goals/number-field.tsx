"use client"

import { useState } from "react"
import { AlertCircle, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  canStepNumberInput,
  formatNumberPreview,
  parseTargetInput,
  stepNumberInput,
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
  /** Keep the label for screen readers only (the surrounding UI names the field). */
  hideLabel?: boolean
  /**
   * Adds - and + buttons around the input for quick changes of one. The
   * labels name the buttons for screen readers, e.g. "Decrease Abyssal whip".
   */
  stepper?: { decreaseLabel: string; increaseLabel: string }
  /** Extra classes for the input itself. */
  inputClassName?: string
  /** An element in the same row after the input, e.g. an Add button. */
  action?: React.ReactNode
  /** Show a validation error before the user has left the field (e.g. after a rejected submit). */
  forceShowError?: boolean
  inputRef?: React.Ref<HTMLInputElement>
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
  hideLabel = false,
  stepper,
  inputClassName,
  action,
  forceShowError = false,
  inputRef,
  autoFocus,
  className,
}: NumberFieldProps) {
  const [touched, setTouched] = useState(false)

  const error = validateNumberInput(value)
  const showError = (touched || forceShowError) && error !== null
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

  const input = (
    <Input
      ref={inputRef}
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
        stepper && "w-20 text-center tabular-nums",
        action && "min-w-0 flex-1",
        showError && "border-danger focus-visible:ring-danger",
        inputClassName
      )}
    />
  )

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label
        htmlFor={id}
        className={cn(
          compact ? "text-xs" : "text-sm font-medium",
          hideLabel && "sr-only"
        )}
      >
        {label}
      </Label>
      {stepper ? (
        <div className="flex items-center gap-1">
          <StepButton
            direction="decrease"
            label={stepper.decreaseLabel}
            compact={compact}
            disabled={!canStepNumberInput(value, -1)}
            onClick={() => onValueChange(stepNumberInput(value, -1))}
          />
          {input}
          <StepButton
            direction="increase"
            label={stepper.increaseLabel}
            compact={compact}
            disabled={!canStepNumberInput(value, 1)}
            onClick={() => onValueChange(stepNumberInput(value, 1))}
          />
        </div>
      ) : action ? (
        <div className="flex items-center gap-2">
          {input}
          {action}
        </div>
      ) : (
        input
      )}
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

interface StepButtonProps {
  direction: "decrease" | "increase"
  label: string
  compact: boolean
  disabled: boolean
  onClick: () => void
}

function StepButton({
  direction,
  label,
  compact,
  disabled,
  onClick,
}: StepButtonProps) {
  const Icon = direction === "decrease" ? Minus : Plus
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      // aria-disabled, not disabled: a disabled button drops keyboard focus,
      // which would strand a user who stepped down to the minimum.
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onClick()
      }}
      className={cn(
        "shrink-0 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        compact && "h-8 w-8"
      )}
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}
