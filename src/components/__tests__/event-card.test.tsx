import { render, screen } from "@testing-library/react"
import { EventCard } from "@/components/event-card"
import type { EventData } from "@/app/actions/events"

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock("@/app/actions/events", () => ({ requestToJoinEvent: jest.fn() }))
jest.mock("@/components/mini-board", () => ({
  MiniBoard: () => <div data-testid="mini-board" />,
}))
jest.mock("@/components/prize-pool-display", () => ({
  PrizePoolDisplay: () => null,
}))

function makeEventData(overrides: Partial<EventData["event"]> = {}): EventData {
  return {
    totalPrizePool: 0,
    event: {
      id: "evt1",
      title: "Summer Bingo",
      description: null,
      timezone: "UTC",
      startDate: new Date("2026-06-01T00:00:00Z"),
      endDate: new Date("2026-06-30T00:00:00Z"),
      registrationDeadline: null,
      role: "admin",
      gameType: "osrs",
      bingos: [{ id: "b1", rows: 3, columns: 3, visible: true }],
      ...overrides,
    },
    managerData: {
      actionItems: { pendingRegistrations: 2, pendingSubmissions: 0 },
      eventStats: { totalParticipants: 0, activeTeams: 0 },
    },
  } as unknown as EventData
}

describe("EventCard", () => {
  it("makes the title a real link to the event", () => {
    render(
      <EventCard eventData={makeEventData()} isParticipant status="active" />
    )
    expect(screen.getByRole("link", { name: "Summer Bingo" })).toHaveAttribute(
      "href",
      "/events/evt1"
    )
  })

  it("renders Manage Event as a link for admins", () => {
    render(
      <EventCard eventData={makeEventData()} isParticipant status="active" />
    )
    expect(screen.getByRole("link", { name: /Manage Event/ })).toHaveAttribute(
      "href",
      "/events/evt1/admin"
    )
  })

  it("summarises pending manager work", () => {
    render(
      <EventCard eventData={makeEventData()} isParticipant status="active" />
    )
    expect(screen.getByText(/join request\(s\)/)).toBeInTheDocument()
  })

  it("shows the mini board for live events but not archived ones", () => {
    const { rerender } = render(
      <EventCard eventData={makeEventData()} isParticipant status="active" />
    )
    expect(screen.getByTestId("mini-board")).toBeInTheDocument()

    rerender(
      <EventCard eventData={makeEventData()} isParticipant status="past" />
    )
    expect(screen.queryByTestId("mini-board")).not.toBeInTheDocument()
  })
})
