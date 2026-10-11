import { render, screen } from "@testing-library/react"
import { EventWhen } from "@/components/dashboard/event-when"

const props = {
  start: new Date("2026-06-18T12:00:00Z"),
  end: new Date("2026-06-25T12:00:00Z"),
  clanName: "Iron Wolves",
  now: new Date("2026-06-15T12:00:00Z"),
}

function mockViewerTz(tz: string) {
  jest
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockReturnValue({ timeZone: tz } as Intl.ResolvedDateTimeFormatOptions)
}

afterEach(() => jest.restoreAllMocks())

describe("EventWhen", () => {
  it("shows range and clan, with no time zone button when zones match", () => {
    mockViewerTz("UTC")
    render(<EventWhen {...props} eventTz="UTC" />)
    expect(screen.getByText(/Jun 18 – Jun 25 · Iron Wolves/)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /start and end times/i })
    ).not.toBeInTheDocument()
  })

  it("offers a button for the official times when zones differ", () => {
    mockViewerTz("America/New_York")
    render(<EventWhen {...props} eventTz="UTC" />)
    expect(
      screen.getByRole("button", { name: /start and end times/i })
    ).toBeInTheDocument()
  })
})
