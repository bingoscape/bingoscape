"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { ListPlus, ListX, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DraftPlayerInfo, DraftPoolState } from "@/lib/draft/types"
import { filterPool, isPoolSort, type PoolFilter } from "@/lib/draft/view"
import { PlayerName, RatingBadge } from "./player-name"

const SKILLS = ["beginner", "intermediate", "advanced", "expert", "pvmgod"]
const ANY = "any"

interface PlayerPoolProps {
  pool: readonly DraftPoolState[]
  players: ReadonlyMap<string, DraftPlayerInfo>
  filter: PoolFilter
  onFilterChange: (key: "q" | "sort" | "skill", value: string) => void
  /** Present when the viewer may pick now; the button label says for whom. */
  pick?: {
    label: string
    onPick: (entry: DraftPoolState) => void
  }
  /** A captain's private pick queue: who is in it, and how to add or drop one. */
  queue?: {
    ids: ReadonlySet<string>
    onToggle: (entry: DraftPoolState) => void
  }
  /**
   * Why the viewer cannot pick right now ("Not your turn"). Every row then
   * shows a Pick button that is `aria-disabled` and carries the reason as a
   * tooltip; it is also written once above the list.
   */
  disabledReason?: string
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

/** The available players, with search, skill filter and sort (URL backed). */
export function PlayerPool({
  pool,
  players,
  filter,
  onFilterChange,
  pick,
  queue,
  disabledReason,
}: PlayerPoolProps) {
  const entries = filterPool(pool, players, filter)
  const available = pool.filter((p) => p.status === "available").length
  const reasonId = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef<(HTMLLIElement | null)[]>([])
  const [active, setActive] = useState(0)
  const activeIndex = Math.min(active, Math.max(0, entries.length - 1))

  // "/" jumps to the search box, like on most sites.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isTyping(event.target)
      ) {
        return
      }
      event.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(entries.length - 1, index))
    setActive(next)
    rowRefs.current[next]?.focus()
  }

  // Arrow keys move between rows (roving tabindex); Enter opens the confirm.
  const onRowKeyDown = (
    event: KeyboardEvent<HTMLLIElement>,
    index: number,
    entry: DraftPoolState
  ) => {
    if (event.target !== event.currentTarget) return
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        moveTo(index + 1)
        break
      case "ArrowUp":
        event.preventDefault()
        moveTo(index - 1)
        break
      case "Home":
        event.preventDefault()
        moveTo(0)
        break
      case "End":
        event.preventDefault()
        moveTo(entries.length - 1)
        break
      case "Enter":
        if (pick) {
          event.preventDefault()
          pick.onPick(entry)
        }
        break
    }
  }

  return (
    <section aria-label="Player pool" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4"
          />
          <Input
            ref={searchRef}
            aria-label="Search players"
            aria-keyshortcuts="/"
            placeholder="Search players"
            className="pl-8"
            value={filter.q}
            onChange={(event) => onFilterChange("q", event.target.value)}
          />
        </div>
        <Select
          value={filter.skill || ANY}
          onValueChange={(value) =>
            onFilterChange("skill", value === ANY ? "" : value)
          }
        >
          <SelectTrigger aria-label="Skill level" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any skill</SelectItem>
            {SKILLS.map((skill) => (
              <SelectItem key={skill} value={skill}>
                {skill}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filter.sort}
          onValueChange={(value) => {
            if (isPoolSort(value)) onFilterChange("sort", value)
          }}
        >
          <SelectTrigger aria-label="Sort players" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rating">By rating</SelectItem>
            <SelectItem value="name">By name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-muted-foreground text-sm">
        {entries.length} of {available} available players
      </p>
      {disabledReason && (
        <p id={reasonId} className="text-sm font-medium">
          {disabledReason}: players cannot be picked right now.
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-muted-foreground rounded-sm border border-dashed p-6 text-center text-sm">
          {available === 0
            ? "Nobody is left in the pool."
            : "No player matches the filter."}
        </p>
      ) : (
        <ul
          aria-label="Available players"
          className="divide-y rounded-sm border"
        >
          {entries.map((entry, index) => {
            const info = entry.userId ? players.get(entry.userId) : undefined
            return (
              <li
                key={entry.poolEntryId}
                ref={(node) => {
                  rowRefs.current[index] = node
                }}
                tabIndex={index === activeIndex ? 0 : -1}
                onFocus={() => setActive(index)}
                onKeyDown={(event) => onRowKeyDown(event, index, entry)}
                aria-describedby={disabledReason ? reasonId : undefined}
                className="focus-visible:ring-ring flex items-center justify-between gap-2 p-2 focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <PlayerName info={info} />
                  {info?.skillLevel && (
                    <span className="text-muted-foreground hidden text-xs sm:inline">
                      {info.skillLevel}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {entry.isNew && <Badge variant="info">New</Badge>}
                  {entry.leftEvent && (
                    <Badge variant="warning">Left event</Badge>
                  )}
                  <RatingBadge rating={entry.rating} />
                  {queue && !entry.leftEvent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      tabIndex={-1}
                      aria-pressed={queue.ids.has(entry.poolEntryId)}
                      aria-label={
                        queue.ids.has(entry.poolEntryId)
                          ? "Remove from my queue"
                          : "Add to my queue"
                      }
                      title={
                        queue.ids.has(entry.poolEntryId)
                          ? "Remove from my queue"
                          : "Add to my queue"
                      }
                      onClick={() => queue.onToggle(entry)}
                    >
                      {queue.ids.has(entry.poolEntryId) ? (
                        <ListX className="h-4 w-4" />
                      ) : (
                        <ListPlus className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  {pick && !entry.leftEvent && (
                    <Button
                      size="sm"
                      tabIndex={-1}
                      aria-keyshortcuts="Enter"
                      onClick={() => pick.onPick(entry)}
                    >
                      {pick.label}
                    </Button>
                  )}
                  {(!pick || entry.leftEvent) && disabledReason && (
                    // Not `disabled`: it stays focusable and keeps its
                    // tooltip, and the text stays at full contrast.
                    <Button
                      size="sm"
                      variant="outline"
                      tabIndex={-1}
                      aria-disabled="true"
                      aria-describedby={reasonId}
                      title={disabledReason}
                      className="cursor-not-allowed"
                      onClick={(event) => event.preventDefault()}
                    >
                      Pick
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
