 

import { render, screen, waitFor } from "@testing-library/react"
import JoinEventPage from "../page"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { getUserRegistrationStatus } from "@/app/actions/events"

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}))

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
  signIn: jest.fn(),
}))

jest.mock("@/app/actions/events", () => ({
  joinEventViaInvite: jest.fn(),
  getUserRegistrationStatus: jest.fn(),
}))

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}))

// Mock fetch for API calls
global.fetch = jest.fn()

describe("JoinEventPage", () => {
  const mockRouter = {
    push: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
      ; (useRouter as jest.Mock).mockReturnValue(mockRouter)
      ; (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: "event-123",
          title: "Test Event",
        }),
      })
  })

  it("redirects to login if user is not authenticated", () => {
    ; (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    })

    render(<JoinEventPage params={{ inviteCode: "invite-123" }} />)

    expect(screen.getByText("Redirecting to login...")).toBeInTheDocument()
  })

  it("shows loading state while checking authentication", () => {
    ; (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "loading",
    })

    render(<JoinEventPage params={{ inviteCode: "invite-123" }} />)

    expect(screen.getByRole("status")).toBeInTheDocument() // Loader component
  })

  it("redirects to event page if user is already approved", async () => {
    ; (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    })
      ; (getUserRegistrationStatus as jest.Mock).mockResolvedValue({
        status: "approved",
      })

    render(<JoinEventPage params={{ inviteCode: "invite-123" }} />)

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/events/event-123")
    })
  })

  it("shows registration status if user has pending registration", async () => {
    ; (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    })
      ; (getUserRegistrationStatus as jest.Mock).mockResolvedValue({
        status: "pending",
        message: "Please approve me",
      })

    render(<JoinEventPage params={{ inviteCode: "invite-123" }} />)

    await waitFor(() => {
      expect(screen.getByText("Registration Status")).toBeInTheDocument()
      expect(screen.getByText("Registration Pending")).toBeInTheDocument()
    })
  })

  it("shows registration status if user has rejected registration", async () => {
    ; (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    })
      ; (getUserRegistrationStatus as jest.Mock).mockResolvedValue({
        status: "rejected",
        message: "Please approve me",
        responseMessage: "Sorry, the event is full",
      })

    render(<JoinEventPage params={{ inviteCode: "invite-123" }} />)

    await waitFor(() => {
      expect(screen.getByText("Registration Status")).toBeInTheDocument()
      expect(screen.getByText("Registration Declined")).toBeInTheDocument()
      expect(screen.getByText("Sorry, the event is full")).toBeInTheDocument()
    })
  })

  it("shows join button if user has no registration", async () => {
    ; (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    })
      ; (getUserRegistrationStatus as jest.Mock).mockResolvedValue({
        status: "not_requested",
      })

    render(<JoinEventPage params={{ inviteCode: "invite-123" }} />)

    await waitFor(() => {
      expect(screen.getByText("You've been invited to join Test Event!")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Join Event" })).toBeInTheDocument()
    })
  })
})

