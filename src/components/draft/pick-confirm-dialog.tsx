"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/components/responsive-dialog"
import type { DraftPlayerInfo, DraftPoolState } from "@/lib/draft/types"
import { playerLabel, ratingPoints } from "@/lib/draft/view"

interface PickConfirmDialogProps {
  entry: DraftPoolState | null
  players: ReadonlyMap<string, DraftPlayerInfo>
  teamName: string
  /** A manager picks for the captain: say so. */
  forced: boolean
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** "Pick X for Team Y?" A full-screen sheet on a phone, a modal elsewhere. */
export function PickConfirmDialog({
  entry,
  players,
  teamName,
  forced,
  pending,
  onConfirm,
  onCancel,
}: PickConfirmDialogProps) {
  const info = entry?.userId ? players.get(entry.userId) : undefined
  const points = ratingPoints(entry?.rating ?? null)

  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onCancel()
      }}
    >
      <ResponsiveDialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm pick</DialogTitle>
          <DialogDescription>
            {forced
              ? `You are picking for ${teamName} as the organizer.`
              : `Picking for ${teamName}.`}
          </DialogDescription>
        </DialogHeader>
        <ResponsiveDialogBody>
          <p className="text-lg font-semibold">{playerLabel(info)}</p>
          <p className="text-muted-foreground text-sm">
            {points === null ? "Unrated" : `Rating ${points} out of 100`}
            {info?.skillLevel ? `, ${info.skillLevel}` : ""}
          </p>
          <p className="text-muted-foreground text-sm">
            A pick cannot be taken back by a captain. Only the organizer can
            undo it.
          </p>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "Picking…" : "Confirm pick"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  )
}
