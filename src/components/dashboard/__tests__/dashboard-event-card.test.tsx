import { render, screen } from "@testing-library/react"
import { DashboardEventCard } from "@/components/dashboard/dashboard-event-card"
import type { EventData } from "@/app/actions/events"

const NOW = new Date("2026-06-15T12:00:00Z")

function make(
  overrides: {
    event?: Record<string, unknown>
    participantData?: EventData["participantData"]
    managerData?: EventData["managerData"]
    totalPrizePool?: number
  } = {}
): EventData {
  return {
    totalPrizePool: overrides.totalPrizePool ?? 0,
    event: {
      id: "evt1",
      title: "Summer Bingo",
      description: "A long description that must not render",
      timezone: "UTC",
      startDate: new Date("2026-06-10T00:00:00Z"),
      endDate: new Date("2026-06-17T12:00:00Z"),
      role: "participant",
      gameType: "osrs",
      clan: { name: "Iron Wolves" },
      bingos: [{ id: "b1", rows: 4, columns: 4, visible: true }],
      ...overrides.event,
    },
    participantData: overrides.participantData,
    managerData: overrides.managerData,
  } as unknown as EventData
}

const team = {
  team: { id: "t1", name: "Team Alpha", memberCount: 5 },
  progress: { completedTiles: 7, totalTiles: 16 },
}

describe("DashboardEventCard", () => {
  it("live player: one title link, status, team progress, no description", () => {
    render(
      <DashboardEventCard
        eventData={make({ participantData: team, totalPrizePool: 25_000_000 })}
        state="active"
        now={NOW}
      />
    )
    expect(screen.getByRole("link", { name: "Summer Bingo" })).toHaveAttribute(
      "href",
      "/events/evt1"
    )
    expect(screen.getByText("Live · ends in 2d")).toBeInTheDocument()
    expect(
      screen.getByRole("progressbar", { name: "Team Alpha progress" })
    ).toHaveAttribute("aria-valuenow", "7")
    expect(screen.getByLabelText("Prize pool 25.0M")).toBeInTheDocument()
    expect(screen.queryByText(/long description/)).not.toBeInTheDocument()
  })

  it("upcoming player: shows start countdown and team but no bar", () => {
    render(
      <DashboardEventCard
        eventData={make({
          participantData: team,
          event: {
            startDate: new Date("2026-06-18T12:00:00Z"),
            endDate: new Date("2026-06-25T12:00:00Z"),
          },
        })}
        state="upcoming"
        now={NOW}
      />
    )
    expect(screen.getByText("Starts in 3d")).toBeInTheDocument()
    expect(screen.getByText("Team Alpha")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("player without a team is told so", () => {
    render(
      <DashboardEventCard eventData={make()} state="active" now={NOW} />
    )
    expect(screen.getByText("No team yet")).toBeInTheDocument()
  })

  it("past: compact, shows end date and final tiles, no prize or bar", () => {
    render(
      <DashboardEventCard
        eventData={make({ participantData: team, totalPrizePool: 5_000_000 })}
        state="past"
        now={NOW}
      />
    )
    expect(screen.getByText("Ended Jun 17")).toBeInTheDocument()
    expect(screen.getByText("7/16 tiles")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Prize pool/)).not.toBeInTheDocument()
  })

  it("admin with pending work: attention links and a named manage button", () => {
    render(
      <DashboardEventCard
        eventData={make({
          event: { role: "admin" },
          managerData: {
            actionItems: { pendingRegistrations: 2, pendingSubmissions: 3 },
            eventStats: { totalParticipants: 24, activeTeams: 6 },
          },
        })}
        state="active"
        now={NOW}
      />
    )
    expect(
      screen.getByRole("link", { name: /Submissions to review for Summer Bingo/ })
    ).toHaveAttribute("href", "/events/evt1/admin/submissions")
    expect(
      screen.getByRole("link", { name: /Join requests for Summer Bingo/ })
    ).toHaveAttribute("href", "/events/evt1/participants?tab=registrations")
    expect(
      screen.getByRole("link", { name: "Manage Summer Bingo" })
    ).toHaveAttribute("href", "/events/evt1/admin")
    expect(screen.queryByText(/players ·/)).not.toBeInTheDocument()
  })

  it("admin without pending work sees the players and teams line", () => {
    render(
      <DashboardEventCard
        eventData={make({
          event: { role: "admin" },
          managerData: {
            actionItems: { pendingRegistrations: 0, pendingSubmissions: 0 },
            eventStats: { totalParticipants: 24, activeTeams: 6 },
          },
        })}
        state="active"
        now={NOW}
      />
    )
    expect(screen.getByText(/24 players/)).toBeInTheDocument()
    expect(
      screen.queryByRole("list", { name: "Needs your attention" })
    ).not.toBeInTheDocument()
  })

  it("management users get no manage gear and route submissions to the event", () => {
    render(
      <DashboardEventCard
        eventData={make({
          event: { role: "management" },
          managerData: {
            actionItems: { pendingRegistrations: 0, pendingSubmissions: 1 },
            eventStats: { totalParticipants: 1, activeTeams: 1 },
          },
        })}
        state="active"
        now={NOW}
      />
    )
    expect(
      screen.queryByRole("link", { name: /^Manage/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Submissions to review/ })
    ).toHaveAttribute("href", "/events/evt1")
  })

  it("upcoming admin with no Board gets a warning", () => {
    render(
      <DashboardEventCard
        eventData={make({ event: { role: "admin", bingos: [] } })}
        state="upcoming"
        now={NOW}
      />
    )
    expect(screen.getByText("No Board yet")).toBeInTheDocument()
  })

  it("marks RS3 events only", () => {
    const { rerender } = render(
      <DashboardEventCard
        eventData={make({ event: { gameType: "rs3" } })}
        state="active"
        now={NOW}
      />
    )
    expect(screen.getByText("RS3")).toBeInTheDocument()
    rerender(
      <DashboardEventCard eventData={make()} state="active" now={NOW} />
    )
    expect(screen.queryByText("RS3")).not.toBeInTheDocument()
    expect(screen.queryByText("OSRS")).not.toBeInTheDocument()
  })
})
