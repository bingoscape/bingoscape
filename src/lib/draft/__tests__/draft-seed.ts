import { replayDraft } from "@/lib/draft/reducer"
import { slotFor } from "@/lib/draft/order"
import type {
  DraftLogEvent,
  DraftPlayerInfo,
  DraftState,
} from "@/lib/draft/types"

/**
 * A finished draft with a skewed pool, for the balance and analytics tests
 * (team draft 4/4, #218): `players` pool players rated like `(n - i) / n`
 * cubed (a few strong players, a long tail), `teams` captains, a snake order,
 * and every pick taken by `choose` from the entries still available.
 */

const START = Date.parse("2026-01-01T00:00:00.000Z")
const at = (seconds: number) => new Date(START + seconds * 1000).toISOString()

export interface SeededDraft {
  events: DraftLogEvent[]
  state: DraftState
  players: Map<string, DraftPlayerInfo>
  /** Rating of each pool entry (null: unrated). */
  ratings: (number | null)[]
}

export interface SeedOptions {
  teams: number
  players: number
  /** Pool indexes (0 = best) that have no rating. */
  unrated?: number[]
  /** Seconds each pick takes; default 10. */
  pickSeconds?: number
  /** Index of the entry to take, from the entries still available (best first). */
  choose?: (available: number[], pickNo: number) => number
  /** UTC offsets, cycled over the pool players; captains get the first one. */
  utcOffsets?: (number | null)[]
}

export function seedDraft(options: SeedOptions): SeededDraft {
  const { teams, players: poolSize } = options
  const unrated = new Set(options.unrated ?? [])
  const ratings = Array.from({ length: poolSize }, (_, i) =>
    unrated.has(i) ? null : ((poolSize - i) / poolSize) ** 3
  )
  const rounds = Math.floor(poolSize / teams)
  const offsets = options.utcOffsets ?? [null]

  const info = (userId: string, i: number): DraftPlayerInfo => ({
    userId,
    name: userId,
    runescapeName: null,
    image: null,
    skillLevel: null,
    utcOffset: offsets[i % offsets.length] ?? null,
  })
  const infos = [
    ...Array.from({ length: teams }, (_, i) => info(`c${i}`, 0)),
    ...Array.from({ length: poolSize }, (_, i) => info(`p${i}`, i)),
  ]

  const events: DraftLogEvent[] = [
    {
      seq: 1,
      type: "created",
      actorUserId: "manager",
      at: at(0),
      payload: {
        orderType: "snake",
        rounds,
        pickTimerSeconds: null,
        onTimeout: "auto_pick",
        autoPickRule: "best_rated",
        slots: Array.from({ length: teams }, (_, i) => ({
          slotId: `s${i}`,
          position: i,
          captainUserId: `c${i}`,
          teamName: `Team ${i + 1}`,
          maxTeamSize: rounds + 1,
        })),
      },
    },
    {
      seq: 2,
      type: "started",
      actorUserId: "manager",
      at: at(0),
      payload: {
        seed: 1,
        permutation: Array.from({ length: teams }, (_, i) => i),
        slots: Array.from({ length: teams }, (_, i) => ({
          slotId: `s${i}`,
          teamId: `t${i}`,
        })),
        pool: ratings.map((rating, i) => ({
          poolEntryId: `e${i}`,
          userId: `p${i}`,
          rating,
          ratingSource: "team_balancing_v1",
        })),
      },
    },
  ]

  const available = Array.from({ length: poolSize }, (_, i) => i)
  const seconds = options.pickSeconds ?? 10
  const totalPicks = rounds * teams
  for (let pickNo = 1; pickNo <= totalPicks; pickNo += 1) {
    const choice = options.choose?.(available, pickNo) ?? 0
    const entry = available.splice(choice, 1)[0]!
    const position = slotFor(pickNo, teams, "snake")
    events.push({
      seq: 2 + pickNo,
      type: "pick",
      actorUserId: `c${position}`,
      at: at(pickNo * seconds),
      payload: {
        pickNo,
        round: Math.ceil(pickNo / teams),
        slotId: `s${position}`,
        poolEntryId: `e${entry}`,
        userId: `p${entry}`,
        auto: false,
        forced: false,
        reason: null,
      },
    })
  }
  events.push({
    seq: 3 + totalPicks,
    type: "completed",
    actorUserId: null,
    at: at(totalPicks * seconds),
    payload: {},
  })

  return {
    events,
    state: replayDraft(events),
    players: new Map(infos.map((p) => [p.userId, p])),
    ratings,
  }
}
