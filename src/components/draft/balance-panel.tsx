import { computeBalance } from "@/lib/draft/balance"
import type { DraftPlayerInfo, DraftState } from "@/lib/draft/types"

interface BalancePanelProps {
  state: DraftState
  players: ReadonlyMap<string, DraftPlayerInfo>
}

const format = (value: number) => value.toFixed(1)

/**
 * How even the teams are over the picks so far: the spread of the teams'
 * rating sums and means, how many of the pool's top players each team has and
 * which time zones it covers. Computed from the live state, so every pick
 * updates it. Shown to every member who can see the draft.
 */
export function BalancePanel({ state, players }: BalancePanelProps) {
  if (state.slots.length < 2 || state.picks.length === 0) return null
  const balance = computeBalance(state, players)

  return (
    <section aria-label="Team balance" className="space-y-2">
      <h3 className="osrs-heading">Balance</h3>
      <p className="text-muted-foreground text-xs">
        Over the picks so far; captains are not rated, unrated players are left
        out of the rating figures.
      </p>
      <div className="overflow-x-auto rounded-sm border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Rating sum, mean, top players and time zones per team
          </caption>
          <thead className="text-muted-foreground text-left text-xs">
            <tr className="border-b">
              <th scope="col" className="p-2 font-medium">
                Team
              </th>
              <th scope="col" className="p-2 text-right font-medium">
                Players
              </th>
              <th scope="col" className="p-2 text-right font-medium">
                Rating sum
              </th>
              <th scope="col" className="p-2 text-right font-medium">
                Mean
              </th>
              <th
                scope="col"
                className="p-2 text-right font-medium"
                title={`Players among the pool's ${balance.topK} best`}
              >
                Top {balance.topK}
              </th>
              <th scope="col" className="p-2 font-medium">
                Time zones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {balance.teams.map((team) => (
              <tr key={team.slotId}>
                <th scope="row" className="p-2 text-left font-medium">
                  {team.teamName}
                </th>
                <td className="p-2 text-right">
                  {team.size}
                  {team.unrated > 0 && (
                    <span
                      className="text-muted-foreground"
                      title="Drafted players without a rating"
                    >
                      {" "}
                      ({team.unrated} unrated)
                    </span>
                  )}
                </td>
                <td className="p-2 text-right">{format(team.ratingSum)}</td>
                <td className="p-2 text-right">
                  {team.ratingMean === null ? "-" : format(team.ratingMean)}
                </td>
                <td className="p-2 text-right">{team.topPlayers}</td>
                <td className="p-2">
                  {team.timezones.labels.length === 0
                    ? "unknown"
                    : team.timezones.labels.join(", ")}
                  {team.timezones.unknown > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      (+{team.timezones.unknown} unknown)
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="inline">Sum stdev </dt>
          <dd className="inline font-medium">
            {format(balance.ratingSum.stdev)}
          </dd>
        </div>
        <div>
          <dt className="inline">Sum spread </dt>
          <dd className="inline font-medium">
            {format(balance.ratingSum.spread)}
          </dd>
        </div>
        <div>
          <dt className="inline">Mean stdev </dt>
          <dd className="inline font-medium">
            {format(balance.ratingMean.stdev)}
          </dd>
        </div>
        <div>
          <dt className="inline">Mean spread </dt>
          <dd className="inline font-medium">
            {format(balance.ratingMean.spread)}
          </dd>
        </div>
      </dl>
    </section>
  )
}
