import type { DraftAnalytics } from "@/lib/draft/analytics"
import type { OptimumComparison } from "@/lib/draft/optimum"
import type { DraftPlayerInfo, DraftState } from "@/lib/draft/types"
import { formatSeconds, playerLabel } from "@/lib/draft/view"

interface DraftAnalyticsPanelProps {
  state: DraftState
  players: ReadonlyMap<string, DraftPlayerInfo>
  analytics: DraftAnalytics
  optimum: OptimumComparison | null
}

/** Post-draft analytics; managers only (the page decides). */
export function DraftAnalyticsPanel({
  state,
  players,
  analytics,
  optimum,
}: DraftAnalyticsPanelProps) {
  const slots = new Map(state.slots.map((s) => [s.slotId, s.teamName]))
  const nameOf = (userId: string | null) =>
    playerLabel(userId ? players.get(userId) : undefined)
  const { timing, autoPicks } = analytics

  return (
    <section aria-label="Draft analytics" className="space-y-4">
      <h2 className="osrs-heading text-lg">Analytics</h2>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Auto-pick rate"
          value={`${Math.round(autoPicks.rate * 100)}%`}
          hint={`${autoPicks.count} of ${analytics.picks.length} picks by the timer${
            autoPicks.timerSkips > 0
              ? `, ${autoPicks.timerSkips} turns lost to it`
              : ""
          }${autoPicks.forced > 0 ? `, ${autoPicks.forced} forced by an organizer` : ""}`}
        />
        <Stat
          label="Average time per pick"
          value={
            timing.averageSeconds === null
              ? "-"
              : formatSeconds(timing.averageSeconds)
          }
          hint={
            timing.measured === 0
              ? "No captain pick to measure"
              : `Median ${formatSeconds(timing.medianSeconds ?? 0)} over ${timing.measured} captain picks${
                  timing.slowest
                    ? `; slowest #${timing.slowest.pickNo} (${formatSeconds(timing.slowest.seconds)})`
                    : ""
                }`
          }
        />
        <Stat
          label="Balance gap to the optimiser"
          value={
            optimum?.gap === null || optimum === null
              ? "-"
              : optimum.gap.toFixed(3)
          }
          hint={
            optimum === null
              ? "Not enough teams to compare"
              : optimum.actual === null
                ? "The team sizes are too uneven to score"
                : `Drafted ${optimum.actual.toFixed(3)} against ${optimum.optimum.toFixed(3)} found by simulated annealing over the same ${optimum.players} players (lower is better)`
          }
        />
        <Stat
          label="Reach and steal threshold"
          value={`${analytics.threshold} picks`}
          hint="A pick this far from the player's rating rank counts"
        />
      </dl>

      <div className="grid gap-4 md:grid-cols-2">
        <PickList
          title="Biggest reaches"
          empty="Nobody went far ahead of their rating."
          picks={analytics.reaches}
          describe={(pick) =>
            `${pick.delta !== null ? Math.abs(pick.delta) : 0} picks early`
          }
          slots={slots}
          nameOf={nameOf}
        />
        <PickList
          title="Biggest steals"
          empty="Nobody lasted far beyond their rating."
          picks={analytics.steals}
          describe={(pick) => `${pick.delta ?? 0} picks late`}
          slots={slots}
          nameOf={nameOf}
        />
      </div>

      <section aria-label="Time per team" className="space-y-2">
        <h3 className="osrs-heading">Time per team</h3>
        <ul className="divide-y rounded-sm border text-sm">
          {timing.perTeam.map((team) => (
            <li
              key={team.slotId}
              className="flex items-center justify-between gap-2 p-2"
            >
              <span>{team.teamName}</span>
              <span className="text-muted-foreground">
                {team.averageSeconds === null
                  ? "no measured pick"
                  : `${formatSeconds(team.averageSeconds)} on average`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="bg-card rounded-sm border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
      <dd className="text-muted-foreground mt-1 text-xs">{hint}</dd>
    </div>
  )
}

function PickList({
  title,
  empty,
  picks,
  describe,
  slots,
  nameOf,
}: {
  title: string
  empty: string
  picks: DraftAnalytics["reaches"]
  describe: (pick: DraftAnalytics["reaches"][number]) => string
  slots: ReadonlyMap<string, string>
  nameOf: (userId: string | null) => string
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="osrs-heading">{title}</h3>
      {picks.length === 0 ? (
        <p className="text-muted-foreground rounded-sm border border-dashed p-4 text-sm">
          {empty}
        </p>
      ) : (
        <ol className="divide-y rounded-sm border text-sm">
          {picks.map((pick) => (
            <li key={pick.pickNo} className="p-2">
              <strong>{nameOf(pick.userId)}</strong>{" "}
              <span className="text-muted-foreground">
                (rated {pick.rating}, rank {pick.ratingRank}) went #
                {pick.pickNo} to {slots.get(pick.slotId) ?? "?"}:{" "}
                {describe(pick)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
