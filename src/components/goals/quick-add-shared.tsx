"use client"

import { AlertCircle, Plus } from "lucide-react"
import type { NewGoalInput } from "@/app/actions/bingo"
import { Button } from "@/components/ui/button"
import type { AddGoalResult } from "./use-pending-goals"

/** What each type form of the quick-add bar needs from the bar. */
export interface QuickAddFormProps {
  /** Adds one top-level Goal (optimistically); resolves once the server answered. */
  onAdd: (input: NewGoalInput) => Promise<AddGoalResult>
  /** Tells screen readers what happened ("Added Abyssal whip x1"). */
  announce: (message: string) => void
}

/**
 * Whether the quick-add bar may take focus when it appears. Not on touch
 * devices (it would open the on-screen keyboard unasked) and not while the
 * user is moving through the page with the keyboard (it would pull focus
 * away from, say, the Tile tabs they are arrowing through).
 */
export function canAutoFocus(): boolean {
  if (window.matchMedia?.("(pointer: coarse)")?.matches) return false
  const active = document.activeElement
  if (!active || active === document.body) return true
  try {
    return !active.matches(":focus-visible")
  } catch {
    // Browsers or test environments without :focus-visible.
    return true
  }
}

interface InlineErrorProps {
  id?: string
  children: React.ReactNode
}

/** A validation message under a field of the quick-add bar. */
export function InlineError({ id, children }: InlineErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      className="text-danger flex items-start gap-1.5 text-xs"
    >
      <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

interface QuickAddButtonProps {
  /** Accessible name, e.g. "Add item". */
  label: string
}

/** The bar's submit button: visible text "Add", named for what it adds. */
export function QuickAddButton({ label }: QuickAddButtonProps) {
  return (
    <Button type="submit" size="sm" aria-label={label} className="shrink-0">
      <Plus aria-hidden="true" />
      Add
    </Button>
  )
}
