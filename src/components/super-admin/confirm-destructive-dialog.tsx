"use client"

import { useId, useRef, useState } from "react"
import type React from "react"
import { AlertTriangle } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import type { DeleteImpact } from "@/lib/super-admin-impact"

export interface ActionResult {
  success: boolean
  error?: string
}

interface ConfirmDestructiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "Delete user" */
  title: string
  /** One sentence on what is about to happen. */
  description: string
  /** The text the admin must type to enable the confirm button. */
  confirmText: string
  /** Label of the thing, used in the prompt: `Type "<confirmText>" to confirm`. */
  confirmHint?: string
  impact: DeleteImpact
  /** "Delete user" */
  confirmLabel: string
  /** Button label while the request runs, default "Deleting…". */
  pendingLabel?: string
  successTitle: string
  successDescription?: string
  onConfirm: () => Promise<ActionResult>
  onSuccess?: () => void
}

/**
 * Shared destructive confirmation: typed-name gate, plain-language impact list,
 * locks while the request runs, focuses Cancel first so Enter never deletes.
 */
export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  confirmHint,
  impact,
  confirmLabel,
  pendingLabel,
  successTitle,
  successDescription,
  onConfirm,
  onSuccess,
}: ConfirmDestructiveDialogProps) {
  const [pending, setPending] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  const guardedOpenChange = (next: boolean) => {
    if (pending && !next) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={guardedOpenChange}>
      <DialogContent
        className="max-h-[90dvh] max-w-md overflow-y-auto"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          cancelRef.current?.focus()
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-danger flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ConfirmBody
          confirmText={confirmText}
          confirmHint={confirmHint}
          impact={impact}
          confirmLabel={confirmLabel}
          pendingLabel={pendingLabel}
          successTitle={successTitle}
          successDescription={successDescription}
          pending={pending}
          setPending={setPending}
          cancelRef={cancelRef}
          onCancel={() => guardedOpenChange(false)}
          onConfirm={onConfirm}
          onSuccess={() => {
            onOpenChange(false)
            onSuccess?.()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

interface ConfirmBodyProps extends Pick<
  ConfirmDestructiveDialogProps,
  | "confirmText"
  | "confirmHint"
  | "impact"
  | "confirmLabel"
  | "pendingLabel"
  | "successTitle"
  | "successDescription"
  | "onConfirm"
> {
  pending: boolean
  setPending: (pending: boolean) => void
  cancelRef: React.RefObject<HTMLButtonElement | null>
  onCancel: () => void
  onSuccess: () => void
}

// Mounted only while the dialog is open, so the typed text and error reset every time.
function ConfirmBody({
  confirmText,
  confirmHint,
  impact,
  confirmLabel,
  pendingLabel,
  successTitle,
  successDescription,
  pending,
  setPending,
  cancelRef,
  onCancel,
  onConfirm,
  onSuccess,
}: ConfirmBodyProps) {
  const { toast } = useToast()
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const matches = typed.trim() === confirmText.trim()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!matches || pending) return
    setPending(true)
    setError(null)
    try {
      const result = await onConfirm()
      if (!result.success) {
        const message =
          result.error ?? "The request failed. Nothing was changed."
        setError(message)
        toast({
          title: "Could not complete",
          description: message,
          variant: "destructive",
        })
        return
      }
      toast({ title: successTitle, description: successDescription })
      onSuccess()
    } catch {
      const message =
        "The request failed. Nothing was changed, you can try again."
      setError(message)
      toast({
        title: "Could not complete",
        description: message,
        variant: "destructive",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-danger font-medium">
            This will permanently delete
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {impact.deletes.map((line) => (
              <li
                key={line.text}
                className={line.strong ? "font-medium" : undefined}
              >
                {line.text}
              </li>
            ))}
          </ul>
        </div>
        {impact.keeps.length > 0 ? (
          <div>
            <p className="font-medium">Not deleted</p>
            <ul className="text-muted-foreground mt-1 list-disc space-y-1 pl-5">
              {impact.keeps.map((line) => (
                <li key={line.text}>{line.text}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="font-medium">This cannot be undone.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={inputId}>
          Type <span className="text-primary font-mono">{confirmText}</span> to
          confirm
        </Label>
        <Input
          id={inputId}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={pending}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        />
        <p id={hintId} className="text-muted-foreground text-xs">
          {confirmHint ?? "The text must match exactly."}
        </p>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-danger text-sm font-medium"
          >
            {error}
          </p>
        ) : null}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          ref={cancelRef}
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={!matches || pending}
        >
          {pending ? (pendingLabel ?? "Deleting…") : confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
