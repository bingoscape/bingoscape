import { render, screen } from "@testing-library/react"
import { RegistrationStatus } from "../registration-status"

describe("RegistrationStatus Component", () => {
  const defaultProps = {
    eventId: "event-123",
    eventTitle: "Test Event",
    status: "pending" as const,
  }

  it("renders pending status correctly", () => {
    render(<RegistrationStatus {...defaultProps} />)

    expect(screen.getByText("Registration Status")).toBeInTheDocument()
    expect(screen.getByText("Your registration status for Test Event")).toBeInTheDocument()
    expect(screen.getByText("Registration Pending")).toBeInTheDocument()
    expect(screen.getByText(/Your registration request is being reviewed/)).toBeInTheDocument()
  })

  it("renders approved status correctly", () => {
    render(<RegistrationStatus {...defaultProps} status="approved" responseMessage="Welcome to the event!" />)

    expect(screen.getByText("Registration Approved")).toBeInTheDocument()
    expect(screen.getByText(/Your registration has been approved/)).toBeInTheDocument()
    expect(screen.getByText("Organizer message:")).toBeInTheDocument()
    expect(screen.getByText("Welcome to the event!")).toBeInTheDocument()
  })

  it("renders rejected status correctly", () => {
    render(
      <RegistrationStatus
        {...defaultProps}
        status="rejected"
        message="I want to join please"
        responseMessage="Sorry, the event is full"
      />,
    )

    expect(screen.getByText("Registration Declined")).toBeInTheDocument()
    expect(screen.getByText(/Your registration request was declined/)).toBeInTheDocument()
    expect(screen.getByText("Reason:")).toBeInTheDocument()
    expect(screen.getByText("Sorry, the event is full")).toBeInTheDocument()
    expect(screen.getByText("Your message:")).toBeInTheDocument()
    expect(screen.getByText("I want to join please")).toBeInTheDocument()
  })

  it("displays user message when provided", () => {
    render(<RegistrationStatus {...defaultProps} message="I'm excited to join this event!" />)

    expect(screen.getByText("Your message:")).toBeInTheDocument()
    expect(screen.getByText("I'm excited to join this event!")).toBeInTheDocument()
  })

  it("includes a link to view the event", () => {
    render(<RegistrationStatus {...defaultProps} />)

    const viewEventButton = screen.getByRole("button", { name: "View Event" })
    expect(viewEventButton).toBeInTheDocument()
    expect(viewEventButton.closest("a")).toHaveAttribute("href", "/events/event-123")
  })
})

