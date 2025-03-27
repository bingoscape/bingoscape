import { render, screen } from "@testing-library/react"
import { useParams } from "next/navigation"
import { getUserRegistrationStatus } from "@/app/actions/events"
import StatusPage from "../page"

// Mock dependencies
jest.mock("next/navigation", () => ({
  useParams: jest.fn(),
}))

jest.mock("@/app/actions/events", () => ({
  getUserRegistrationStatus: jest.fn(),
}))

describe("StatusPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
      ; (useParams as jest.Mock).mockReturnValue({ id: "event-123" })
  })

  it("renders loading state initially", () => {
    ; (getUserRegistrationStatus as jest.Mock).mockResolvedValue({
      status: "pending",
    })

    render(<StatusPage />)

    expect(screen.getByRole("status")).toBeInTheDocument() // Loader component
  })

  it("renders pending registration status", async () => {
    ; (getUserRegistrationStatus as jest.Mock).mockResolvedValue({
      status: "pending",
      message: "Please approve me",
      eventTitle: "Test Event",
    })

    render(<StatusPage />)

    // Wait for the async data to load
    expect(await screen.findByText("Registration Status")).toBeInTheDocument()
    expect(screen.getByText("Registration Pending")).toBeInTheDocument()
    expect(screen.getByText(/Your registration request is being reviewed/)).toBeInTheDocument()
  })

  it("renders approved registration status", async () => {
    ; (getUserRegistrationStatus as jest.Mock).mockResolvedValue({
      status: "approved",
      message: "Please approve me",
      responseMessage: "Welcome to the event!",
      eventTitle: "Test Event",
    })

    render(<StatusPage />)

    // Wait for the async data to load
    expect(await screen.findByText("Registration Status")).toBeInTheDocument()
    expect(screen.getByText("Registration Approved")).toBeInTheDocument()
    expect(screen.getByText(/Your registration has been approved/)).toBeInTheDocument()
    expect(screen.getByText("Welcome to the event!")).toBeInTheDocument()
  })

  it("renders rejected registration status", async () => {
    ; (getUserRegistrationStatus as jest.Mock).mockResolvedValue({
      status: "rejected",
      message: "Please approve me",
      responseMessage: "Sorry, the event is full",
      eventTitle: "Test Event",
    })

    render(<StatusPage />)

    // Wait for the async data to load
    expect(await screen.findByText("Registration Status")).toBeInTheDocument()
    expect(screen.getByText("Registration Declined")).toBeInTheDocument()
    expect(screen.getByText(/Your registration request was declined/)).toBeInTheDocument()
    expect(screen.getByText("Sorry, the event is full")).toBeInTheDocument()
  })

  it("renders error message when registration status cannot be fetched", async () => {
    ; (getUserRegistrationStatus as jest.Mock).mockRejectedValue(new Error("Failed to fetch registration status"))

    render(<StatusPage />)

    // Wait for the async error to be caught
    expect(await screen.findByText("Error")).toBeInTheDocument()
    expect(screen.getByText("Failed to fetch registration status")).toBeInTheDocument()
  })
})

