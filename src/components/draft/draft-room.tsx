"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { forcePick, makePick } from "@/app/actions/draft"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import type { DraftSnapshot } from "@/server/draft/queries"
import type { DraftPoolState } from "@/lib/draft/types"
import { isDraftTab, onTurnSlot } from "@/lib/draft/view"
import { cn } from "@/lib/utils"
import { OnTheClockBanner } from "./on-the-clock-banner"
import { OrganizerControls } from "./organizer-controls"
import { PickConfirmDialog } from "./pick-confirm-dialog"
import { PickLog } from "./pick-log"
import { PlayerPool } from "./player-pool"
import { TeamRosterColumn } from "./team-roster-column"
import { useDraftParams } from "./use-draft-params"
import { useDraftPolling } from "./use-draft-polling"

interface DraftRoomProps {
  eventId: string
  snapshot: DraftSnapshot
  viewerUserId: string
  /** `draft:manage`: sees the organizer controls and may force a pick. */
  canManage: boolean
  /** Leads a Team: may pick when it is that Team's turn. */
  canPick: boolean
}

/**
 * The draft room. Everything it shows comes from the server rendered
 * `snapshot`; `useDraftPolling` re-renders the page (`router.refresh()`) when
 * the draft changes. Desktop shows pool, teams and log side by side; below
 * `lg` they are tabs (`?tab=pool|teams|log`).
 */
export function DraftRoom({
  eventId,
  snapshot,
  viewerUserId,
  canManage,
  canPick,
}: DraftRoomProps) {
  const router = useRouter()
  const { state } = snapshot
  const params = useDraftParams()
  const players = useMemo(
    () => new Map(snapshot.players.map((p) => [p.userId, p])),
    [snapshot.players]
  )
  const [pending, setPending] = useState<DraftPoolState | null>(null)
  const [busy, setBusy] = useState(false)

  useDraftPolling({
    eventId,
    lastSeq: state.lastSeq,
    enabled:
      state.status !== "cancelled" &&
      !(state.status === "complete" && state.applied),
  })

  const onTurn = onTurnSlot(state)
  const running = state.status === "in_progress"
  const myTurn = running && onTurn?.captainUserId === viewerUserId && canPick
  // A manager picks for the captain only while it is not their own turn.
  const forcing = running && canManage && !myTurn && onTurn !== null
  const pickAction = myTurn
    ? { label: "Pick", forced: false }
    : forcing
      ? { label: "Pick for team", forced: true }
      : null

  const confirmPick = async () => {
    if (!pending || !pickAction) return
    setBusy(true)
    try {
      const input = {
        draftId: snapshot.draftId,
        poolEntryId: pending.poolEntryId,
      }
      const result = pickAction.forced
        ? await forcePick(input)
        : await makePick(input)
      if (result.success) {
        setPending(null)
        router.refresh()
      } else {
        toast({
          title: result.error ?? "The pick failed",
          variant: "destructive",
        })
        // Someone else's pick or a status change got there first: show it.
        router.refresh()
        setPending(null)
      }
    } catch {
      toast({ title: "The pick failed", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const draftedCount = state.picks.length
  const panel = (name: "pool" | "teams" | "log") =>
    cn(params.tab !== name && "hidden lg:block")

  return (
    <div className="space-y-4">
      <OnTheClockBanner
        state={state}
        players={players}
        viewerUserId={viewerUserId}
      />

      {canManage && (
        <OrganizerControls
          draftId={snapshot.draftId}
          state={state}
          teamCount={state.slots.length}
          draftedCount={draftedCount}
        />
      )}

      <Tabs
        value={params.tab}
        onValueChange={(value) => {
          if (isDraftTab(value))
            params.setParam("tab", value === "pool" ? null : value)
        }}
        className="lg:hidden"
      >
        <TabsList className="w-full">
          <TabsTrigger value="pool" className="flex-1">
            Pool
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex-1">
            Teams
          </TabsTrigger>
          <TabsTrigger value="log" className="flex-1">
            Log
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className={panel("pool")}>
          <h2 className="osrs-heading mb-2 hidden text-lg lg:block">
            Player pool
          </h2>
          <PlayerPool
            pool={state.pool}
            players={players}
            filter={{ q: params.q, skill: params.skill, sort: params.sort }}
            onFilterChange={(key, value) => params.setParam(key, value || null)}
            pick={
              pickAction
                ? { label: pickAction.label, onPick: setPending }
                : undefined
            }
          />
          {state.status === "setup" && (
            <p className="text-muted-foreground text-sm">
              The pool is frozen when the draft starts.
            </p>
          )}
        </div>
        <div className={panel("teams")}>
          <h2 className="osrs-heading mb-2 hidden text-lg lg:block">Teams</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {state.slots.map((slot) => (
              <TeamRosterColumn
                key={slot.slotId}
                state={state}
                slot={slot}
                players={players}
                onTheClock={running && onTurn?.slotId === slot.slotId}
              />
            ))}
          </div>
        </div>
        <div className={panel("log")}>
          <h2 className="osrs-heading mb-2 hidden text-lg lg:block">
            Pick log
          </h2>
          <PickLog state={state} players={players} />
        </div>
      </div>

      <PickConfirmDialog
        entry={pending}
        players={players}
        teamName={onTurn?.teamName ?? "the team"}
        forced={pickAction?.forced ?? false}
        pending={busy}
        onConfirm={confirmPick}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
