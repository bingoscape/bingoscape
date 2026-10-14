import { Badge } from "@/components/ui/badge"
import type { PickAnalysis } from "@/lib/draft/analytics"
import type { DraftPlayerInfo, DraftState } from "@/lib/draft/types"
import { formatSeconds, playerLabel, ratingPoints } from "@/lib/draft/view"

interface PickHistoryTableProps {
  state: DraftState
  players: ReadonlyMap<string, DraftPlayerInfo>
  /**
   * Managers only: the analysis of each pick adds the rating rank, how far the
   * pick was from it, and the time the captain took.
   */
  analysis?: readonly PickAnalysis[]
}

const VERDICT_LABEL = {
  reach: "Reach",
  steal: "Steal",
  fair: "Fair",
} as const

/** Every standing pick in order, as a table. */
export function PickHistoryTable({
  state,
  players,
  analysis,
}: PickHistoryTableProps) {
  const slots = new Map(state.slots.map((s) => [s.slotId, s]))
  const ratingOf = new Map(state.pool.map((e) => [e.poolEntryId, e.rating]))
  const analysed = new Map(analysis?.map((a) => [a.pickNo, a]))

  return (
    <section aria-label="Pick history" className="space-y-2">
      <h2 className="osrs-heading text-lg">Pick history</h2>
      {state.picks.length === 0 ? (
        <p className="text-muted-foreground rounded-sm border border-dashed p-6 text-center text-sm">
          No picks were made.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border">
          <table className="w-full text-sm">
            <caption className="sr-only">Picks in order</caption>
            <thead className="text-muted-foreground text-left text-xs">
              <tr className="border-b">
                <th scope="col" className="p-2 text-right font-medium">
                  #
                </th>
                <th scope="col" className="p-2 font-medium">
                  Round
                </th>
                <th scope="col" className="p-2 font-medium">
                  Team
                </th>
                <th scope="col" className="p-2 font-medium">
                  Player
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Rating
                </th>
                {analysis && (
                  <>
                    <th scope="col" className="p-2 text-right font-medium">
                      Rating rank
                    </th>
                    <th scope="col" className="p-2 font-medium">
                      Value
                    </th>
                    <th scope="col" className="p-2 text-right font-medium">
                      Time
                    </th>
                  </>
                )}
                <th scope="col" className="p-2 font-medium">
                  Made by
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {state.picks.map((pick) => {
                const own = analysed.get(pick.pickNo)
                const points = ratingPoints(
                  ratingOf.get(pick.poolEntryId) ?? null
                )
                return (
                  <tr key={pick.pickNo}>
                    <td className="text-muted-foreground p-2 text-right">
                      {pick.pickNo}
                    </td>
                    <td className="p-2">{pick.round}</td>
                    <td className="p-2">
                      {slots.get(pick.slotId)?.teamName ?? "?"}
                    </td>
                    <td className="p-2">
                      {playerLabel(
                        pick.userId ? players.get(pick.userId) : undefined
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {points === null ? (
                        <span className="text-muted-foreground">Unrated</span>
                      ) : (
                        points
                      )}
                    </td>
                    {analysis && (
                      <>
                        <td className="p-2 text-right">
                          {own?.ratingRank ?? "-"}
                        </td>
                        <td className="p-2">
                          {own?.verdict ? (
                            <Badge
                              variant={
                                own.verdict === "steal"
                                  ? "success"
                                  : own.verdict === "reach"
                                    ? "warning"
                                    : "outline"
                              }
                            >
                              {VERDICT_LABEL[own.verdict]}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {own?.seconds != null
                            ? formatSeconds(own.seconds)
                            : "-"}
                        </td>
                      </>
                    )}
                    <td className="p-2">
                      {pick.forced
                        ? "Organizer"
                        : pick.auto
                          ? "Timer"
                          : "Captain"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
