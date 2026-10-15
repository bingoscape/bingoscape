import { render, screen } from "@testing-library/react"

import { DraftEntryLink } from "@/components/draft/draft-entry-link"
import type { DraftStatus } from "@/lib/draft/types"

function renderLink(
  status: DraftStatus | null,
  { canManage = false, canView = true } = {}
) {
  render(
    <DraftEntryLink
      eventId="event-1"
      status={status}
      canManage={canManage}
      canView={canView}
    />
  )
}

describe("DraftEntryLink", () => {
  it("lets a member without a team into the room before a draft exists", () => {
    renderLink(null)
    expect(
      screen.getByRole("link", { name: /Join live draft/ })
    ).toHaveAttribute("href", "/events/event-1/draft")
    expect(
      screen.queryByRole("link", { name: /Set up draft/ })
    ).not.toBeInTheDocument()
  })

  it.each(["setup", "open", "in_progress", "paused"] as const)(
    "offers the room as 'Join live draft' while the draft is %s",
    (status) => {
      renderLink(status)
      expect(
        screen.getByRole("link", { name: /Join live draft/ })
      ).toHaveAttribute("href", "/events/event-1/draft")
    }
  )

  it("shows the Live badge", () => {
    renderLink("in_progress")
    expect(screen.getByText("Live")).toBeInTheDocument()
  })

  it("shows the Paused badge", () => {
    renderLink("paused")
    expect(screen.getByText("Paused")).toBeInTheDocument()
  })

  it("calls a finished draft the team draft", () => {
    renderLink("complete")
    expect(screen.getByRole("link", { name: "Team draft" })).toHaveAttribute(
      "href",
      "/events/event-1/draft"
    )
  })

  it("gives a manager both setup and the room when there is no draft", () => {
    renderLink(null, { canManage: true })
    expect(screen.getByRole("link", { name: "Set up draft" })).toHaveAttribute(
      "href",
      "/events/event-1/draft/setup"
    )
    expect(
      screen.getByRole("link", { name: "Join live draft" })
    ).toHaveAttribute("href", "/events/event-1/draft")
  })

  it("renders nothing for someone who cannot view the draft", () => {
    renderLink("in_progress", { canView: false })
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
