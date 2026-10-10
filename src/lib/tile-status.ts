/**
 * Pure helpers that derive a Team's progress on Tiles from the data the Event
 * page already loads (Tile -> teamTileSubmissions -> submissions).
 */

export type TileCompletion = "completed" | "incomplete"
export type TileSubmissionState = "needs_review" | "pending" | "approved" | null

interface StatusSubmission {
  status: string
}

interface StatusTeamTileSubmission {
  teamId: string
  status: string
  submissions?: StatusSubmission[]
}

export interface StatusTile {
  id: string
  isHidden: boolean
  weight: number
  teamTileSubmissions?: StatusTeamTileSubmission[]
}

export interface TileTeamStatus {
  completion: TileCompletion
  submissionState: TileSubmissionState
}

/** Completion plus the most urgent Submission state for one Team. */
export function getTileTeamStatus(
  tile: Pick<StatusTile, "teamTileSubmissions">,
  teamId: string | undefined
): TileTeamStatus {
  const record = teamId
    ? tile.teamTileSubmissions?.find((tts) => tts.teamId === teamId)
    : undefined

  if (!record) return { completion: "incomplete", submissionState: null }

  const completion: TileCompletion =
    record.status === "completed" ? "completed" : "incomplete"

  let submissionState: TileSubmissionState = null
  const submissions = record.submissions ?? []
  if (record.status === "needs_attention") submissionState = "needs_review"
  else if (submissions.some((s) => s.status === "needs_review"))
    submissionState = "needs_review"
  else if (submissions.some((s) => s.status === "pending"))
    submissionState = "pending"
  else if (submissions.length > 0) submissionState = "approved"

  return { completion, submissionState }
}

export interface BoardStats {
  total: number
  completed: number
  pending: number
  needsReview: number
  remaining: number
  /** Total XP of completed Tiles. */
  xpEarned: number
  /** Total XP available on the Board. */
  xpTotal: number
  /** 0-100, rounded. */
  percent: number
}

/** Counters shown in the board header. Hidden Tiles still count as cells. */
export function getBoardStats(
  tiles: StatusTile[] | undefined,
  teamId: string | undefined
): BoardStats {
  const list = tiles ?? []
  const stats: BoardStats = {
    total: list.length,
    completed: 0,
    pending: 0,
    needsReview: 0,
    remaining: 0,
    xpEarned: 0,
    xpTotal: 0,
    percent: 0,
  }

  for (const tile of list) {
    stats.xpTotal += tile.weight
    const { completion, submissionState } = getTileTeamStatus(tile, teamId)
    if (completion === "completed") {
      stats.completed++
      stats.xpEarned += tile.weight
    } else if (submissionState === "needs_review") {
      stats.needsReview++
    } else if (submissionState === "pending") {
      stats.pending++
    }
  }

  stats.remaining =
    stats.total - stats.completed - stats.pending - stats.needsReview
  stats.percent =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  return stats
}

/** Tiles of this Team that need a human next: changes requested, then pending. */
export function getAttentionTiles<T extends StatusTile>(
  tiles: T[] | undefined,
  teamId: string | undefined
): Array<{ tile: T; state: "needs_review" | "pending" }> {
  const result: Array<{ tile: T; state: "needs_review" | "pending" }> = []
  for (const tile of tiles ?? []) {
    const { completion, submissionState } = getTileTeamStatus(tile, teamId)
    if (completion === "completed") continue
    if (submissionState === "needs_review" || submissionState === "pending") {
      result.push({ tile, state: submissionState })
    }
  }
  // changes requested first
  return result.sort(
    (a, b) =>
      (a.state === "needs_review" ? 0 : 1) -
      (b.state === "needs_review" ? 0 : 1)
  )
}
