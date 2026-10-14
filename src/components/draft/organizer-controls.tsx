"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Pause,
  Play,
  Rocket,
  SkipForward,
  Undo2,
  Users,
  XCircle,
} from "lucide-react"

import {
  applyDraft,
  cancelDraft,
  pauseDraft,
  resumeDraft,
  skipTurn,
  startDraft,
  undoPick,
} from "@/app/actions/draft"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import type { DraftState } from "@/lib/draft/types"

type Confirming = "start" | "cancel" | "undo" | "apply" | "skip" | null

interface OrganizerControlsProps {
  draftId: string
  state: DraftState
  /** Teams the draft will create / the players the apply will place. */
  teamCount: number
  draftedCount: number
}

/**
 * Start, pause / resume, skip, undo, cancel and "Apply teams"; shown to
 * managers only. (Picking for the captain is the Pick button of the pool.)
 */
export function OrganizerControls({
  draftId,
  state,
  teamCount,
  draftedCount,
}: OrganizerControlsProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState<Confirming>(null)
  const [busy, setBusy] = useState(false)

  const run = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    success: string
  ) => {
    setBusy(true)
    try {
      const result = await action()
      if (result.success) {
        toast({ title: success })
        router.refresh()
      } else {
        toast({
          title: result.error ?? "Something went wrong",
          variant: "destructive",
        })
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const { status, applied } = state
  const live = status === "in_progress" || status === "paused"
  const canUndo =
    (live || (status === "complete" && !applied)) && state.picks.length > 0

  if (status === "cancelled" || (status === "complete" && applied)) return null

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Organizer controls"
    >
      {(status === "setup" || status === "open") && (
        <Button disabled={busy} onClick={() => setConfirming("start")}>
          <Rocket className="mr-2 h-4 w-4" />
          Start draft
        </Button>
      )}
      {status === "in_progress" && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => run(() => pauseDraft({ draftId }), "Draft paused")}
        >
          <Pause className="mr-2 h-4 w-4" />
          Pause
        </Button>
      )}
      {status === "in_progress" && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setConfirming("skip")}
        >
          <SkipForward className="mr-2 h-4 w-4" />
          Skip turn
        </Button>
      )}
      {status === "paused" && (
        <Button
          disabled={busy}
          onClick={() => run(() => resumeDraft({ draftId }), "Draft resumed")}
        >
          <Play className="mr-2 h-4 w-4" />
          Resume
        </Button>
      )}
      {canUndo && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setConfirming("undo")}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Undo last pick
        </Button>
      )}
      {status === "complete" && !applied && (
        <Button disabled={busy} onClick={() => setConfirming("apply")}>
          <Users className="mr-2 h-4 w-4" />
          Apply teams
        </Button>
      )}
      <Button
        variant="destructive"
        disabled={busy}
        onClick={() => setConfirming("cancel")}
      >
        <XCircle className="mr-2 h-4 w-4" />
        Cancel draft
      </Button>

      <ConfirmDialog
        open={confirming === "start"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Start the draft?"
        description={`This creates ${teamCount} teams with their captains and freezes the player pool. Captains can pick as soon as it starts.`}
        confirmLabel="Start draft"
        onConfirm={() => run(() => startDraft({ draftId }), "Draft started")}
      />
      <ConfirmDialog
        open={confirming === "undo"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Undo the last pick?"
        description="The player goes back to the pool and the pick returns to the captain's turn, with a fresh timer. The pick stays in the audit log."
        confirmLabel="Undo pick"
        onConfirm={() => run(() => undoPick({ draftId }), "Pick undone")}
      />
      <ConfirmDialog
        open={confirming === "skip"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Skip this turn?"
        description="The captain on the clock loses this pick and the next team is up. Teams may end up uneven."
        confirmLabel="Skip turn"
        onConfirm={() => run(() => skipTurn({ draftId }), "Turn skipped")}
      />
      <ConfirmDialog
        open={confirming === "apply"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Apply the teams?"
        description={`This puts the ${draftedCount} drafted players on their teams. Players left in the pool stay unassigned. It cannot be undone from here.`}
        confirmLabel="Apply teams"
        onConfirm={() => run(() => applyDraft({ draftId }), "Teams applied")}
      />
      <ConfirmDialog
        open={confirming === "cancel"}
        onOpenChange={(open) => !open && setConfirming(null)}
        variant="destructive"
        title="Cancel the draft?"
        description="Teams this draft created are deleted if they only hold their captain. Picks are discarded."
        confirmLabel="Cancel draft"
        onConfirm={() => run(() => cancelDraft({ draftId }), "Draft cancelled")}
      />
    </div>
  )
}
