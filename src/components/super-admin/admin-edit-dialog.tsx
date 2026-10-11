"use client"

import { createContext, useContext, useState } from "react"
import type React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface EditDialogControls {
  pending: boolean
  setPending: (pending: boolean) => void
  close: () => void
}

const EditDialogContext = createContext<EditDialogControls | null>(null)

export function useEditDialog(): EditDialogControls {
  const ctx = useContext(EditDialogContext)
  if (!ctx)
    throw new Error("useEditDialog must be used inside <AdminEditDialog>")
  return ctx
}

interface AdminEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children: React.ReactNode
}

/**
 * Dialog shell for edit forms. Children are only mounted while open, so each form
 * keeps its own state and starts fresh from props every time the dialog opens.
 * The dialog cannot be dismissed while a request is in flight.
 */
export function AdminEditDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: AdminEditDialogProps) {
  const [pending, setPending] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-h-[90dvh] max-w-md overflow-y-auto"
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <EditDialogContext.Provider
          value={{ pending, setPending, close: () => onOpenChange(false) }}
        >
          {children}
        </EditDialogContext.Provider>
      </DialogContent>
    </Dialog>
  )
}

export function EditDialogFooter({
  submitLabel,
  pendingLabel,
  disabled,
}: {
  submitLabel: string
  pendingLabel: string
  disabled?: boolean
}) {
  const { pending, close } = useEditDialog()
  return (
    <DialogFooter className="gap-2 sm:gap-0">
      <Button
        type="button"
        variant="outline"
        onClick={close}
        disabled={pending}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={pending || disabled}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </DialogFooter>
  )
}
