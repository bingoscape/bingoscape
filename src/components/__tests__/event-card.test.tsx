/* eslint-disable */
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { EventCard } from "../event-card"
import { requestToJoinEvent } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

// Mock dependencies
jest.mock("@/app/actions/events", () => ({
  requestToJoinEvent: jest.fn(),
  getUserRegistrationStatus: jest.fn(),
}))

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}))

// Mock current date for consistent testing
const mockDate = new Date("2023-06-15T12:00:00Z")
global.Date = jest.fn(() => mockDate) as any
global.Date.now = jest.fn(() => mockDate.getTime())

describe("EventCard Component", () => {
  const mockRouter = {
    push: jest.fn(),
  }

  const mockEventData = {
    event: {
      id: "event-123",
      title: "Test Event",
      description: "This is a test event",
      startDate: "2023-06-10T00:00:00Z",
      endDate: "2023-06-20T00:00:00Z",
      registrationDeadline: "2023-06-18T00:00:00Z",
      requiresApproval: false,
      locked: false,
      clan: { name: "Test Clan" },
      bingos: [{ id: "bingo-1" }],
      eventParticipants: [],
    },
    totalPrizePool: 1000,
  }

  beforeEach(() => {
    jest.clearAllMocks()
      ; (useRouter as jest.Mock).mockReturnValue(mockRouter)
  })

  it("renders event details correctly", () => {
    render(<EventCard eventData={mockEventData} isParticipant={false} />)

    expect(screen.getByText("Test Event")).toBeInTheDocument()
    expect(screen.getByText("This is a test event")).toBeInTheDocument()
    expect(screen.getByText("Test Clan")).toBeInTheDocument()
    expect(screen.getByText("1 Bingos")).toBeInTheDocument()
    expect(screen.getByText(/Registration: 6\/18\/2023/)).toBeInTheDocument()
  })

  it("shows Join button when user is not a participant", () => {
    render(<EventCard eventData={mockEventData} isParticipant={false} />)

    expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument()
  })

  it("does not show Join button when user is a participant", () => {
    render(<EventCard eventData={mockEventData} isParticipant={true} />)

    expect(screen.queryByRole("button", { name: "Join" })).not.toBeInTheDocument()
  })

  it("shows Request to Join button when event requires approval", () => {
    const eventWithApproval = {
      ...mockEventData,
      event: {
        ...mockEventData.event,
        requiresApproval: true,
      },
    }

    render(<EventCard eventData={eventWithApproval} isParticipant={false} />)

    expect(screen.getByRole("button", { name: "Request to Join" })).toBeInTheDocument()
    expect(screen.getByText("Requires approval to join")).toBeInTheDocument()
  })

  it("shows request form when Request to Join is clicked", () => {
    const eventWithApproval = {
      ...mockEventData,
      event: {
        ...mockEventData.event,
        requiresApproval: true,
      },
    }

    render(<EventCard eventData={eventWithApproval} isParticipant={false} />)

    fireEvent.click(screen.getByRole("button", { name: "Request to Join" }))

    expect(screen.getByPlaceholderText(/Why do you want to join this event/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Submit Request" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
  })

  it("submits request when form is submitted", async () => {
    const eventWithApproval = {
      ...mockEventData,
      event: {
        ...mockEventData.event,
        requiresApproval: true,
      },
    }
      ; (requestToJoinEvent as jest.Mock).mockResolvedValue({})

    render(<EventCard eventData={eventWithApproval} isParticipant={false} />)

    // Click Request to Join button
    fireEvent.click(screen.getByRole("button", { name: "Request to Join" }))

    // Enter message
    fireEvent.change(screen.getByPlaceholderText(/Why do you want to join this event/), {
      target: { value: "I'm excited to join!" },
    })

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: "Submit Request" }))

    await waitFor(() => {
      expect(requestToJoinEvent).toHaveBeenCalledWith("event-123", "I'm excited to join!")
      expect(toast).toHaveBeenCalledWith({
        title: "Request submitted",
        description: "Your registration request has been submitted for review.",
      })
      expect(mockRouter.push).toHaveBeenCalledWith("/events/event-123/status")
    })
  })

  it("shows View Status button when registration is pending", () => {
    const registrationStatus = {
      status: "pending" as const,
      message: "Please approve me",
    }

    const eventWithApproval = {
      ...mockEventData,
      event: {
        ...mockEventData.event,
        requiresApproval: true,
      },
    }

    render(<EventCard eventData={eventWithApproval} isParticipant={false} registrationStatus={registrationStatus} />)

    expect(screen.getByText("Registration pending approval")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "View Status" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Request to Join" })).not.toBeInTheDocument()
  })

  it("shows View Status button when registration is rejected", () => {
    const registrationStatus = {
      status: "rejected" as const,
      message: "Please approve me",
      responseMessage: "Sorry, the event is full",
    }

    const eventWithApproval = {
      ...mockEventData,
      event: {
        ...mockEventData.event,
        requiresApproval: true,
      },
    }

    render(<EventCard eventData={eventWithApproval} isParticipant={false} registrationStatus={registrationStatus} />)

    expect(screen.getByText("Registration rejected")).toBeInTheDocument()
    expect(screen.getByText("Reason: Sorry, the event is full")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "View Status" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Request to Join" })).not.toBeInTheDocument()
  })

  it("shows Closed button when registration is closed", () => {
    const closedEvent = {
      ...mockEventData,
      event: {
        ...mockEventData.event,
        registrationDeadline: "2023-06-01T00:00:00Z", // Past date
      },
    }

    render(<EventCard eventData={closedEvent} isParticipant={false} />)

    expect(screen.getByText("(Closed)")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Closed" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Closed" })).toBeDisabled()
  })
})

