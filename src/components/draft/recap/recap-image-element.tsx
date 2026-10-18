import type { ReactElement } from "react"

import { getTeamHslColor } from "@/lib/discord-webhook"
import type { DraftPlayerInfo, DraftState } from "@/lib/draft/types"
import { playerLabel, rosterOf } from "@/lib/draft/view"

/**
 * The "Share as image" picture of the final rosters, drawn by `next/og`
 * (Satori) in `api/events/[id]/draft/recap-image`. Satori only understands a
 * flexbox subset, so every container is `display: flex` and the sizes are
 * computed here instead of left to layout.
 */

const WIDTH = 1200
const PADDING = 32
const GAP = 16
const HEADER = 96
const CARD_HEADER = 48
const ROW = 32
const CARD_PADDING = 12
const MAX_COLUMNS = 4
/** The picture stays shareable: more than this is cut off and counted. */
const MAX_ROWS_PER_TEAM = 14

export interface RecapImage {
  element: ReactElement
  width: number
  height: number
}

export function buildRecapImage(
  eventTitle: string,
  state: DraftState,
  players: ReadonlyMap<string, DraftPlayerInfo>
): RecapImage {
  const teams = state.slots.map((slot) => {
    const roster = rosterOf(state, slot).map((entry) => ({
      name: playerLabel(entry.userId ? players.get(entry.userId) : undefined),
      captain: entry.captain,
    }))
    return {
      name: slot.teamName,
      color: getTeamHslColor(slot.teamName),
      rows: roster.slice(0, MAX_ROWS_PER_TEAM),
      more: Math.max(0, roster.length - MAX_ROWS_PER_TEAM),
    }
  })

  const columns = Math.max(1, Math.min(MAX_COLUMNS, teams.length))
  const cardWidth = Math.floor(
    (WIDTH - PADDING * 2 - GAP * (columns - 1)) / columns
  )
  const lines = Math.max(
    1,
    ...teams.map((t) => t.rows.length + (t.more ? 1 : 0))
  )
  const cardHeight = CARD_HEADER + CARD_PADDING * 2 + lines * ROW
  const gridRows = Math.max(1, Math.ceil(teams.length / columns))
  const height =
    PADDING * 2 + HEADER + gridRows * cardHeight + (gridRows - 1) * GAP

  const element = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: WIDTH,
        height,
        padding: PADDING,
        background: "#1c1b17",
        color: "#f4efe4",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: HEADER,
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
          Team draft
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#b9b2a0" }}>
          {eventTitle}
          {state.applied ? "" : " (not applied yet)"}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: GAP,
        }}
      >
        {teams.map((team) => (
          <div
            key={team.name}
            style={{
              display: "flex",
              flexDirection: "column",
              width: cardWidth,
              height: cardHeight,
              padding: CARD_PADDING,
              background: "#2a2823",
              borderTop: `6px solid ${team.color}`,
              borderRadius: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                height: CARD_HEADER,
                fontSize: 26,
                fontWeight: 700,
                alignItems: "center",
              }}
            >
              {team.name}
            </div>
            {team.rows.map((row, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  height: ROW,
                  alignItems: "center",
                  fontSize: 22,
                  color: row.captain ? "#ffd75e" : "#f4efe4",
                }}
              >
                {row.captain ? `Captain ${row.name}` : row.name}
              </div>
            ))}
            {team.more > 0 && (
              <div
                style={{
                  display: "flex",
                  height: ROW,
                  alignItems: "center",
                  fontSize: 20,
                  color: "#b9b2a0",
                }}
              >
                {`+${team.more} more`}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
  return { element, width: WIDTH, height }
}
