import type { DraftAutoPickRule } from "./constants"

/**
 * Who is picked when a captain's timer runs out (team draft 3/4, #217). Pure:
 * the caller passes the candidates (available players who are still in the
 * Event) and a random source, so the rules are unit tested without a database.
 *
 * Order of preference:
 * 1. the first entry of the captain's own queue that is still a candidate;
 * 2. `best_rated`: the highest `rating_snapshot`, unrated players last, ties
 *    in candidate order; `random`: any candidate.
 */

export interface AutoPickCandidate {
  poolEntryId: string
  /** 0..1, or null for an unrated player. */
  rating: number | null
}

export interface AutoPickChoice {
  poolEntryId: string
  /** `queue`: the captain's own list decided; `rule`: the draft's rule. */
  source: "queue" | "rule"
}

export interface AutoPickInput {
  rule: DraftAutoPickRule
  /** Eligible players, in a stable order (the order breaks rating ties). */
  candidates: readonly AutoPickCandidate[]
  /** The captain's preferred pool entry ids, best first. */
  queue?: readonly string[]
  /** A uniform integer in `[0, bound)`. */
  randomInt: (bound: number) => number
}

export function chooseAutoPick(input: AutoPickInput): AutoPickChoice | null {
  const { candidates } = input
  if (candidates.length === 0) return null

  const eligible = new Set(candidates.map((c) => c.poolEntryId))
  const queued = input.queue?.find((id) => eligible.has(id))
  if (queued) return { poolEntryId: queued, source: "queue" }

  if (input.rule === "random") {
    const index = input.randomInt(candidates.length)
    const chosen =
      candidates[Math.min(Math.max(index, 0), candidates.length - 1)]
    return chosen ? { poolEntryId: chosen.poolEntryId, source: "rule" } : null
  }

  let best: AutoPickCandidate | null = null
  for (const candidate of candidates) {
    if (
      best === null ||
      (candidate.rating !== null &&
        (best.rating === null || candidate.rating > best.rating))
    ) {
      best = candidate
    }
  }
  return best ? { poolEntryId: best.poolEntryId, source: "rule" } : null
}

export const MAX_QUEUE_LENGTH = 50

/**
 * A captain's submitted queue reduced to what can be stored: no duplicates,
 * only ids in `allowed`, at most `MAX_QUEUE_LENGTH`, order kept.
 */
export function normalizeQueue(
  requested: readonly string[],
  allowed: ReadonlySet<string>
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of requested) {
    if (!allowed.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= MAX_QUEUE_LENGTH) break
  }
  return out
}
