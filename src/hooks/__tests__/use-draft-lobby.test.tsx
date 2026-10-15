import { act, renderHook } from "@testing-library/react"
import { useRouter } from "next/navigation"

import { useDraftLobby } from "@/hooks/use-draft-lobby"
import { POLL_INTERVAL_MS } from "@/hooks/use-draft-stream"

const fetchMock = jest.fn()
const refresh = jest.fn()

const response = (status: number, body?: unknown, etag?: string) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => (name === "ETag" ? (etag ?? null) : null) },
  json: async () => body,
})

const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms)
    for (let i = 0; i < 10; i++) await Promise.resolve()
  })

const setVisibility = (value: "visible" | "hidden") =>
  Object.defineProperty(document, "visibilityState", {
    value,
    configurable: true,
  })

beforeEach(() => {
  jest.useFakeTimers()
  global.fetch = fetchMock as unknown as typeof fetch
  fetchMock.mockReset()
  refresh.mockReset()
  jest
    .mocked(useRouter)
    .mockReturnValue({ refresh } as unknown as ReturnType<typeof useRouter>)
  setVisibility("visible")
})

afterEach(() => jest.useRealTimers())

describe("useDraftLobby", () => {
  it("keeps waiting (sending its ETag) while there is no draft", async () => {
    fetchMock.mockResolvedValueOnce(response(200, { draft: null }, '"none"'))
    fetchMock.mockResolvedValue(response(304))
    renderHook(() => useDraftLobby("event-1"))
    await advance(0)
    await advance(POLL_INTERVAL_MS)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/events/event-1/draft/state",
      expect.objectContaining({ headers: {} })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/events/event-1/draft/state",
      expect.objectContaining({ headers: { "If-None-Match": '"none"' } })
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it("refreshes the page once a draft exists", async () => {
    fetchMock.mockResolvedValueOnce(response(200, { draft: null }, '"none"'))
    fetchMock.mockResolvedValue(
      response(200, { draft: { draftId: "draft-1" } }, '"some"')
    )
    renderHook(() => useDraftLobby("event-1"))
    await advance(0)
    expect(refresh).not.toHaveBeenCalled()
    await advance(POLL_INTERVAL_MS)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("checks right away for a draft created since the render", async () => {
    fetchMock.mockResolvedValue(response(200, { draft: { draftId: "d" } }))
    renderHook(() => useDraftLobby("event-1"))
    await advance(0)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("does not poll while the tab is hidden, and checks when it returns", async () => {
    setVisibility("hidden")
    fetchMock.mockResolvedValue(response(304))
    renderHook(() => useDraftLobby("event-1"))
    await advance(POLL_INTERVAL_MS * 3)
    expect(fetchMock).not.toHaveBeenCalled()

    setVisibility("visible")
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("stops for good when the viewer may not see the draft", async () => {
    fetchMock.mockResolvedValue(response(403))
    renderHook(() => useDraftLobby("event-1"))
    await advance(POLL_INTERVAL_MS * 3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("survives a failed request and tries again", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"))
    fetchMock.mockResolvedValue(response(200, { draft: { draftId: "d" } }))
    renderHook(() => useDraftLobby("event-1"))
    await advance(0)
    expect(refresh).not.toHaveBeenCalled()
    await advance(POLL_INTERVAL_MS)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("stops polling on unmount", async () => {
    fetchMock.mockResolvedValue(response(304))
    const { unmount } = renderHook(() => useDraftLobby("event-1"))
    await advance(0)
    unmount()
    fetchMock.mockClear()
    await advance(POLL_INTERVAL_MS * 3)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
