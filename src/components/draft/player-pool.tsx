"use client"

import { Search } from "lucide-react"

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
}

/** The available players, with search, skill filter and sort (URL backed). */
export function PlayerPool({
  pool,
  players,
  filter,
  onFilterChange,
  pick,
}: PlayerPoolProps) {
  const entries = filterPool(pool, players, filter)
  const available = pool.filter((p) => p.status === "available").length

  return (
    <section aria-label="Player pool" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4"
          />
          <Input
            aria-label="Search players"
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

      {entries.length === 0 ? (
        <p className="text-muted-foreground rounded-sm border border-dashed p-6 text-center text-sm">
          {available === 0
            ? "Nobody is left in the pool."
            : "No player matches the filter."}
        </p>
      ) : (
        <ul className="divide-y rounded-sm border">
          {entries.map((entry) => {
            const info = entry.userId ? players.get(entry.userId) : undefined
            return (
              <li
                key={entry.poolEntryId}
                className="flex items-center justify-between gap-2 p-2"
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
                  <RatingBadge rating={entry.rating} />
                  {pick && (
                    <Button size="sm" onClick={() => pick.onPick(entry)}>
                      {pick.label}
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
