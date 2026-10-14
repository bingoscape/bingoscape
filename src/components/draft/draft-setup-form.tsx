"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react"

import { createDraft } from "@/app/actions/draft"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import {
  DRAFT_AUTO_PICK_RULES,
  DRAFT_ON_TIMEOUT,
  DRAFT_ORDER_TYPES,
  type DraftAutoPickRule,
  type DraftOnTimeout,
  type DraftOrderType,
} from "@/lib/draft/constants"
import {
  MAX_DRAFT_CAPTAINS,
  MAX_DRAFT_ROUNDS,
  describeDraftSetup,
  summarizeDraftSetup,
} from "@/lib/draft/setup"
import type { DraftPlayerInfo } from "@/lib/draft/types"
import { playerLabel } from "@/lib/draft/view"

const ORDER_LABELS: Record<DraftOrderType, string> = {
  snake: "Snake (reverses every round)",
  linear: "Linear (same order every round)",
  random_snake: "Random snake (shuffled once, then snake)",
}
const TIMEOUT_LABELS: Record<DraftOnTimeout, string> = {
  auto_pick: "Auto-pick a player",
  skip: "Skip the turn",
  pause: "Pause the draft",
}
const RULE_LABELS: Record<DraftAutoPickRule, string> = {
  best_rated: "Best rated available player",
  random: "Random available player",
}

interface DraftSetupFormProps {
  eventId: string
  /** Participants without a Team: the pool, and who can captain. */
  candidates: DraftPlayerInfo[]
}

interface Captain {
  userId: string
  teamName: string
}

/** Setup of a team draft: order, rounds, timer, captains and a preview. */
export function DraftSetupForm({ eventId, candidates }: DraftSetupFormProps) {
  const router = useRouter()
  const [orderType, setOrderType] = useState<DraftOrderType>("snake")
  const [rounds, setRounds] = useState(5)
  const [timer, setTimer] = useState(0)
  const [onTimeout, setOnTimeout] = useState<DraftOnTimeout>("auto_pick")
  // Empty: the captain plus one player per round.
  const [maxTeamSize, setMaxTeamSize] = useState("")
  const [autoPickRule, setAutoPickRule] =
    useState<DraftAutoPickRule>("best_rated")
  const [captains, setCaptains] = useState<Captain[]>([])
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState(false)

  const byId = useMemo(
    () => new Map(candidates.map((c) => [c.userId, c])),
    [candidates]
  )
  const chosen = new Set(captains.map((c) => c.userId))
  const matches = candidates
    .filter((c) => !chosen.has(c.userId))
    .filter((c) =>
      playerLabel(c).toLowerCase().includes(search.trim().toLowerCase())
    )
    .slice(0, 8)

  const summary = summarizeDraftSetup({
    poolSize: Math.max(0, candidates.length - captains.length),
    captains: captains.length,
    rounds,
  })
  const valid =
    captains.length >= 2 &&
    captains.every((c) => c.teamName.trim().length > 0) &&
    Number.isInteger(rounds) &&
    rounds >= 1 &&
    rounds <= MAX_DRAFT_ROUNDS &&
    Number.isInteger(timer) &&
    timer >= 0 &&
    (maxTeamSize === "" ||
      (Number.isInteger(Number(maxTeamSize)) &&
        Number(maxTeamSize) >= 2 &&
        Number(maxTeamSize) <= MAX_DRAFT_ROUNDS + 1))

  const addCaptain = (userId: string) => {
    if (captains.length >= MAX_DRAFT_CAPTAINS) return
    setCaptains((list) => [
      ...list,
      { userId, teamName: `Team ${playerLabel(byId.get(userId))}` },
    ])
    setSearch("")
  }
  const move = (index: number, by: -1 | 1) =>
    setCaptains((list) => {
      const next = [...list]
      const target = index + by
      if (target < 0 || target >= next.length) return list
      ;[next[index], next[target]] = [next[target]!, next[index]!]
      return next
    })

  const submit = async () => {
    setBusy(true)
    try {
      const result = await createDraft({
        eventId,
        orderType,
        rounds,
        pickTimerSeconds: timer > 0 ? timer : null,
        onTimeout,
        autoPickRule,
        ...(maxTeamSize === "" ? {} : { maxTeamSize: Number(maxTeamSize) }),
        captains: captains.map((c) => ({
          userId: c.userId,
          teamName: c.teamName.trim(),
        })),
      })
      if (result.success) {
        router.push(`/events/${eventId}/draft`)
      } else {
        toast({ title: result.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Could not create the draft", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid && !busy) void submit()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="draft-order">Order</Label>
          <Select
            value={orderType}
            onValueChange={(v) => setOrderType(v as DraftOrderType)}
          >
            <SelectTrigger id="draft-order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DRAFT_ORDER_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {ORDER_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="draft-rounds">Rounds</Label>
          <Input
            id="draft-rounds"
            type="number"
            min={1}
            max={MAX_DRAFT_ROUNDS}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="draft-timer">Pick timer (seconds, 0 = off)</Label>
          <Input
            id="draft-timer"
            type="number"
            min={0}
            value={timer}
            onChange={(e) => setTimer(Number(e.target.value))}
          />
          <p className="text-muted-foreground text-xs">
            The clock is the server&apos;s. When it runs out, the setting on the
            right applies.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="draft-timeout">When the timer runs out</Label>
          <Select
            value={onTimeout}
            onValueChange={(v) => setOnTimeout(v as DraftOnTimeout)}
          >
            <SelectTrigger id="draft-timeout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DRAFT_ON_TIMEOUT.map((value) => (
                <SelectItem key={value} value={value}>
                  {TIMEOUT_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onTimeout === "skip" && (
            <p role="alert" className="text-xs font-medium text-amber-600">
              A captain who runs out of time loses that pick, so teams may end
              up uneven.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="draft-rule">Auto-pick rule</Label>
          <Select
            value={autoPickRule}
            onValueChange={(v) => setAutoPickRule(v as DraftAutoPickRule)}
          >
            <SelectTrigger id="draft-rule">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DRAFT_AUTO_PICK_RULES.map((value) => (
                <SelectItem key={value} value={value}>
                  {RULE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="draft-max-team">Max team size (optional)</Label>
          <Input
            id="draft-max-team"
            type="number"
            min={2}
            max={MAX_DRAFT_ROUNDS + 1}
            placeholder={String(rounds + 1)}
            value={maxTeamSize}
            onChange={(e) => setMaxTeamSize(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Captain included. A team that reached it is passed over.
          </p>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="osrs-heading text-lg">Captains</legend>
        <p className="text-muted-foreground text-sm">
          Captains come from the participants without a team. Their order is the
          pick order of the first round.
        </p>
        <div className="space-y-2">
          <Label htmlFor="draft-captain-search">Add a captain</Label>
          <Input
            id="draft-captain-search"
            placeholder="Search participants"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="divide-y rounded-sm border">
            {matches.length === 0 && (
              <li className="text-muted-foreground p-2 text-sm">
                No participant matches.
              </li>
            )}
            {matches.map((c) => (
              <li
                key={c.userId}
                className="flex items-center justify-between gap-2 p-2"
              >
                <span className="truncate">{playerLabel(c)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addCaptain(c.userId)}
                  disabled={captains.length >= MAX_DRAFT_CAPTAINS}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </div>

        {captains.length > 0 && (
          <ol className="space-y-2">
            {captains.map((captain, index) => (
              <li
                key={captain.userId}
                className="flex flex-wrap items-center gap-2 rounded-sm border p-2"
              >
                <span className="text-muted-foreground w-6 text-right text-sm">
                  {index + 1}
                </span>
                <span className="min-w-28 flex-1 truncate font-medium">
                  {playerLabel(byId.get(captain.userId))}
                </span>
                <Input
                  aria-label={`Team name of ${playerLabel(byId.get(captain.userId))}`}
                  className="w-full sm:w-56"
                  value={captain.teamName}
                  maxLength={255}
                  onChange={(e) =>
                    setCaptains((list) =>
                      list.map((c) =>
                        c.userId === captain.userId
                          ? { ...c, teamName: e.target.value }
                          : c
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Move down"
                  disabled={index === captains.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Remove captain"
                  onClick={() =>
                    setCaptains((list) =>
                      list.filter((c) => c.userId !== captain.userId)
                    )
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </fieldset>

      <p
        role="status"
        className="bg-card rounded-sm border p-3 text-sm"
        data-testid="draft-preview"
      >
        {captains.length < 2
          ? "Add at least two captains to see the draft preview."
          : describeDraftSetup(summary)}
      </p>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/events/${eventId}/teams`)}
        >
          Back
        </Button>
        <Button type="submit" disabled={!valid || busy}>
          {busy ? "Creating…" : "Create draft"}
        </Button>
      </div>
    </form>
  )
}
