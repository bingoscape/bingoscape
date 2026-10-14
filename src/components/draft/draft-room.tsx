"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Trophy } from "lucide-react"

import { forcePick, makePick, setPickQueue } from "@/app/actions/draft"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDraftStream } from "@/hooks/use-draft-stream"
import { toast } from "@/hooks/use-toast"
import type { DraftPoolState, DraftSnapshot } from "@/lib/draft/types"
import { isDraftTab, onTurnSlot } from "@/lib/draft/view"
import { cn } from "@/lib/utils"
import { BalancePanel } from "./balance-panel"
import { ConnectionIndicator } from "./connection-indicator"
import { DraftAlerts } from "./draft-alerts"
import { OnTheClockBanner } from "./on-the-clock-banner"
import { OrganizerControls } from "./organizer-controls"
import { PickConfirmDialog } from "./pick-confirm-dialog"
import { PickLog } from "./pick-log"
import { PickQueue } from "./pick-queue"
import { PlayerPool } from "./player-pool"
import { TeamRosterColumn } from "./team-roster-column"
import { TurnCueControls, useTurnCues } from "./turn-cues"
import { UnassignedList } from "./unassigned-list"
import { useDraftParams } from "./use-draft-params"
import { useFreshPicks } from "./use-fresh-picks"

interface DraftRoomProps {
  eventId: string
  snapshot: DraftSnapshot
  viewerUserId: string
  /** `draft:manage`: sees the organizer controls and may force a pick. */
  canManage: boolean
  /** Leads a Team: may pick when it is that Team's turn. */
  canPick: boolean
  /** The viewer's own saved pick queue (pool entry ids, best first). */
  initialQueue?: string[]
}

/** A pick the viewer just made that the server has not confirmed yet. */
interface PendingPick {
  poolEntryId: string
  userId: string | null
  rating: number | null
  slotId: string
  /** `lastSeq` when it was made: any newer event settles it one way or the other. */
  baseSeq: number
}

/**
 * The draft room. It starts from the server rendered `snapshot` and
 * `useDraftStream` keeps it live (stream, polling as the fallback). A pick is
 * optimistic: the player moves to the roster as a pending row at once and
 * returns to the pool with a toast if the server refuses. Desktop shows pool,
 * teams and log side by side; below `lg` they are tabs
 * (`?tab=pool|teams|log`).
 */
export function DraftRoom({
  eventId,
  snapshot,
  viewerUserId,
  canManage,
  canPick,
  initialQueue = [],
}: DraftRoomProps) {
  const { live, connection, sync, active, clockOffsetMs } = useDraftStream({
    eventId,
    snapshot,
  })
  const { state } = live
  const params = useDraftParams()
  const players = useMemo(
    () => new Map(live.players.map((p) => [p.userId, p])),
    [live.players]
  )
  const [pending, setPending] = useState<DraftPoolState | null>(null)
  const [ghost, setGhost] = useState<PendingPick | null>(null)
  const [busy, setBusy] = useState(false)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  const freshPicks = useFreshPicks(state.picks)

  // The captain's private pick queue (used when the timer runs out).
  const [queue, setQueue] = useState<string[]>(initialQueue)
  const [queueBusy, setQueueBusy] = useState(false)
  const queueEnabled =
    canPick &&
    (state.status === "in_progress" || state.status === "paused") &&
    state.slots.some((slot) => slot.captainUserId === viewerUserId)
  const queuedEntries = queue.flatMap((id) => {
    const entry = state.pool.find((e) => e.poolEntryId === id)
    return entry && entry.status === "available" && !entry.leftEvent
      ? [entry]
      : []
  })
  const saveQueue = async (next: string[]) => {
    const previous = queue
    setQueue(next)
    setQueueBusy(true)
    try {
      const result = await setPickQueue({
        draftId: live.draftId,
        poolEntryIds: next,
      })
      if (!result.success) {
        setQueue(previous)
        toast({
          title: result.error ?? "The queue was not saved",
          variant: "destructive",
        })
      }
    } catch {
      setQueue(previous)
      toast({ title: "The queue was not saved", variant: "destructive" })
    } finally {
      setQueueBusy(false)
    }
  }
  const queuedIds = queuedEntries.map((e) => e.poolEntryId)
  const toggleQueued = (entry: DraftPoolState) =>
    void saveQueue(
      queuedIds.includes(entry.poolEntryId)
        ? queuedIds.filter((id) => id !== entry.poolEntryId)
        : [...queuedIds, entry.poolEntryId]
    )
  const moveQueued = (poolEntryId: string, by: -1 | 1) => {
    const index = queuedIds.indexOf(poolEntryId)
    const target = index + by
    if (index < 0 || target < 0 || target >= queuedIds.length) return
    const next = [...queuedIds]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    void saveQueue(next)
  }

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

  useTurnCues({ myTurn, teamName: onTurn?.teamName ?? "Your team" })

  // The pending pick shows only while nothing else happened since: once the
  // server event (or anyone else's) arrives the real state takes over.
  const ghostEntry =
    ghost &&
    ghost.baseSeq === state.lastSeq &&
    state.pool.find((e) => e.poolEntryId === ghost.poolEntryId)?.status ===
      "available"
      ? ghost
      : null

  const confirmPick = async () => {
    if (!pending || !pickAction || !onTurn || busy) return
    const entry = pending
    setPending(null)
    setBusy(true)
    setGhost({
      poolEntryId: entry.poolEntryId,
      userId: entry.userId,
      rating: entry.rating,
      slotId: onTurn.slotId,
      baseSeq: state.lastSeq,
    })
    try {
      const input = {
        draftId: live.draftId,
        poolEntryId: entry.poolEntryId,
      }
      const result = pickAction.forced
        ? await forcePick(input)
        : await makePick(input)
      // Fetch what happened right away; the stream may be a moment behind.
      const events = await sync()
      if (!result.success) {
        setGhost(null)
        const taker = events.find(
          (e) =>
            e.type === "pick" && e.payload.poolEntryId === entry.poolEntryId
        )
        const takenSlot =
          taker?.type === "pick"
            ? taker.payload.slotId
            : stateRef.current.picks.find(
                (p) => p.poolEntryId === entry.poolEntryId
              )?.slotId
        const takenBy = takenSlot
          ? stateRef.current.slots.find((s) => s.slotId === takenSlot)?.teamName
          : undefined
        toast({
          title: takenBy
            ? `Taken by ${takenBy}`
            : (result.error ?? "The pick failed"),
          variant: "destructive",
        })
      }
    } catch {
      setGhost(null)
      toast({ title: "The pick failed", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  // Why a viewer who has a role in the draft cannot pick right now.
  const disabledReason =
    !pickAction && (canPick || canManage)
      ? running
        ? "Not your turn"
        : state.status === "paused"
          ? "The draft is paused"
          : state.status === "setup" || state.status === "open"
            ? "The draft has not started"
            : null
      : null

  const draftedCount = state.picks.length
  const panel = (name: "pool" | "teams" | "log") =>
    cn(params.tab !== name && "hidden lg:block")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {state.status === "complete" && (
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/events/${eventId}/draft/recap`}>
              <Trophy className="h-4 w-4" aria-hidden="true" />
              View recap
            </Link>
          </Button>
        )}
        {canPick && active && <TurnCueControls />}
        {active && <ConnectionIndicator connection={connection} />}
      </div>

      {/* Assertive on purpose: being on the clock must interrupt. */}
      <div role="alert" className="sr-only">
        {myTurn ? "It is your turn to pick." : ""}
      </div>

      <OnTheClockBanner
        state={state}
        players={players}
        viewerUserId={viewerUserId}
        clockOffsetMs={clockOffsetMs}
        onTimerExpired={() => void sync()}
      />

      {canManage && <DraftAlerts state={state} players={players} />}

      {canManage && (
        <OrganizerControls
          draftId={live.draftId}
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
            pool={
              ghostEntry
                ? state.pool.filter(
                    (e) => e.poolEntryId !== ghostEntry.poolEntryId
                  )
                : state.pool
            }
            players={players}
            filter={{ q: params.q, skill: params.skill, sort: params.sort }}
            viewerUserId={viewerUserId}
            onFilterChange={(key, value) => params.setParam(key, value || null)}
            pick={
              pickAction
                ? {
                    label: pickAction.label,
                    onPick: (entry) => {
                      if (!busy) setPending(entry)
                    },
                  }
                : undefined
            }
            queue={
              queueEnabled
                ? {
                    ids: new Set(queuedIds),
                    onToggle: toggleQueued,
                  }
                : undefined
            }
            disabledReason={disabledReason ?? undefined}
          />
          {queueEnabled && (
            <div className="mt-4">
              <PickQueue
                entries={queuedEntries}
                players={players}
                busy={queueBusy}
                onMove={moveQueued}
                onRemove={(id) =>
                  void saveQueue(queuedIds.filter((x) => x !== id))
                }
              />
            </div>
          )}
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
                viewerUserId={viewerUserId}
                onTheClock={running && onTurn?.slotId === slot.slotId}
                ghost={
                  ghostEntry?.slotId === slot.slotId ? ghostEntry : undefined
                }
                freshPicks={freshPicks}
              />
            ))}
          </div>
          <div className="mt-4">
            <BalancePanel state={state} players={players} />
          </div>
          <div className="mt-4">
            <UnassignedList
              state={state}
              lateJoiners={live.lateJoiners}
              players={players}
              viewerUserId={viewerUserId}
            />
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
        pending={false}
        onConfirm={confirmPick}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
