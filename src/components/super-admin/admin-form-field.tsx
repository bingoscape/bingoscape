"use client"

import { useId } from "react"
import type React from "react"

import { Label } from "@/components/ui/label"

interface FieldControlProps {
  id: string
  "aria-describedby": string | undefined
  "aria-invalid": boolean | undefined
  "aria-required": boolean | undefined
}

interface FormFieldProps {
  label: string
  error?: string | null
  hint?: string
  required?: boolean
  children: (props: FieldControlProps) => React.ReactNode
}

/** Label + control + hint + inline error, wired together with id / aria-describedby. */
export function FormField({
  label,
  error,
  hint,
  required,
  children,
}: FormFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-danger text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Form-level failure (server error). Announced because it appears after submit. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="text-danger text-sm font-medium">
      {message}
    </p>
  )
}
