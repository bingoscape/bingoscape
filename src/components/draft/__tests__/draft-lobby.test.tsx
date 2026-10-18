import { act, render, screen } from "@testing-library/react"
import { useRouter } from "next/navigation"

import { DraftLobby } from "@/components/draft/draft-lobby"

const fetchMock = jest.fn()
const refresh = jest.fn()

const answer = (draft: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({ draft }),
})

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
  })

beforeEach(() => {
  jest.useFakeTimers()
  global.fetch = fetchMock as unknown as typeof fetch
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(answer(null))
  refresh.mockReset()
  jest
    .mocked(useRouter)
    .mockReturnValue({ refresh } as unknown as ReturnType<typeof useRouter>)
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  })
})

afterEach(() => jest.useRealTimers())

describe("DraftLobby", () => {
  it("tells a member the draft opens by itself and offers no setup", async () => {
    render(<DraftLobby eventId="event-1" canManage={false} />)
    await settle()
    expect(screen.getByText("Waiting for the draft")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(
      "A manager has not set up the team draft yet."
    )
    expect(
      screen.queryByRole("link", { name: "Set up a draft" })
    ).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events/event-1/draft/state",
      expect.anything()
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it("offers a manager the setup page", async () => {
    render(<DraftLobby eventId="event-1" canManage />)
    await settle()
    expect(
      screen.getByRole("link", { name: "Set up a draft" })
    ).toHaveAttribute("href", "/events/event-1/draft/setup")
  })

  it("refreshes the page when a draft appears", async () => {
    fetchMock.mockResolvedValue(answer({ draftId: "draft-1" }))
    render(<DraftLobby eventId="event-1" canManage={false} />)
    await settle()
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
