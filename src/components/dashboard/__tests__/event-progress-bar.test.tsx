import { render, screen } from "@testing-library/react"
import { EventProgressBar } from "@/components/dashboard/event-progress-bar"

describe("EventProgressBar", () => {
  it("exposes value, range and a visible count", () => {
    render(<EventProgressBar label="Alpha progress" completed={7} total={16} />)
    const bar = screen.getByRole("progressbar", { name: "Alpha progress" })
    expect(bar).toHaveAttribute("aria-valuenow", "7")
    expect(bar).toHaveAttribute("aria-valuemax", "16")
    expect(screen.getByText("7 / 16")).toBeInTheDocument()
  })

  it("clamps out-of-range values", () => {
    render(<EventProgressBar label="Over" completed={30} total={16} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "16"
    )
  })

  it("renders nothing when there are no tiles", () => {
    const { container } = render(
      <EventProgressBar label="Empty" completed={0} total={0} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
