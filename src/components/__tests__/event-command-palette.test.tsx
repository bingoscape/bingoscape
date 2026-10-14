import { fireEvent, render, screen } from "@testing-library/react"
import type { UUID } from "crypto"

import { EventCommandPalette } from "@/components/event-command-palette"
import type { DraftStatus } from "@/lib/draft/types"

// Radix warns about a dialog without a description; the palette predates this.
beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined)
})
afterEach(() => jest.restoreAllMocks())

const EVENT_ID = "11111111-1111-4111-8111-111111111111" as UUID

function open(draft?: {
  status: DraftStatus | null
  canView: boolean
  canManage: boolean
}) {
  render(
    <EventCommandPalette
      eventId={EVENT_ID}
      pendingRegistrationsCount={0}
      canEditEvent={false}
      isPublic={false}
      hasClan={false}
      draft={draft}
      createBingoModal={null}
      importExportModal={null}
      generateInviteLink={null}
      shareEventButton={null}
      discordWebhooks={null}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: /Quick Actions/ }))
}

describe("EventCommandPalette: team draft", () => {
  it("offers the draft room when the Event has a draft", () => {
    open({ status: "in_progress", canView: true, canManage: false })
    expect(screen.getByText("Team Draft")).toBeInTheDocument()
    expect(
      screen.getByText("The draft is live: watch the picks")
    ).toBeInTheDocument()
    expect(screen.queryByText("Set Up Team Draft")).not.toBeInTheDocument()
    expect(screen.queryByText("Team Draft Recap")).not.toBeInTheDocument()
  })

  it("adds the recap when the draft is complete", () => {
    open({ status: "complete", canView: true, canManage: false })
    expect(screen.getByText("Team Draft")).toBeInTheDocument()
    expect(screen.getByText("Team Draft Recap")).toBeInTheDocument()
  })

  it("offers setup to a manager when there is no draft", () => {
    open({ status: null, canView: true, canManage: true })
    expect(screen.getByText("Set Up Team Draft")).toBeInTheDocument()
    expect(screen.queryByText("Team Draft")).not.toBeInTheDocument()
  })

  it("offers nothing without a draft to someone who cannot manage it", () => {
    open({ status: null, canView: true, canManage: false })
    expect(screen.queryByText(/Team Draft/)).not.toBeInTheDocument()
  })

  it("offers nothing to someone who cannot view the draft", () => {
    open({ status: "in_progress", canView: false, canManage: false })
    expect(screen.queryByText(/Team Draft/)).not.toBeInTheDocument()
  })

  it("finds the draft by searching for it", () => {
    open({ status: "in_progress", canView: true, canManage: false })
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "spectate" },
    })
    expect(screen.getByText("Team Draft")).toBeInTheDocument()
    expect(screen.queryByText("Event Statistics")).not.toBeInTheDocument()
  })
})
