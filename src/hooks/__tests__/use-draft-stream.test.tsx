import { act, renderHook } from "@testing-library/react"

import {
  backoffDelay,
  POLL_INTERVAL_MS,
  useDraftStream,
} from "@/hooks/use-draft-stream"
import { FakeEventSource } from "./fake-event-source"
import type { DraftLogEvent, DraftSnapshot } from "@/lib/draft/types"
import {
  created,
  pickEvent,
  snapshotOf,
  started,
} from "@/lib/draft/__tests__/draft-fixtures"

const fetchMock = jest.fn()

const jsonResponse = (body: unknown, etag?: string) => ({
  ok: true,
  status: 200,
  headers: { get: (name: string) => (name === "ETag" ? (etag ?? null) : null) },
  json: async () => body,
})

const snapshot0 = snapshotOf([created, started])

function setup(snapshot: DraftSnapshot = snapshot0) {
  return renderHook(
    (props: { snapshot: DraftSnapshot }) =>
      useDraftStream({ eventId: "event-1", snapshot: props.snapshot }),
    { initialProps: { snapshot } }
  )
}

/** Advances the clock and lets the fetch chains it starts settle. */
const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms)
    for (let i = 0; i < 10; i++) await Promise.resolve()
  })

const emitDraft = (event: DraftLogEvent) =>
  act(() => FakeEventSource.last.emit("draft", event))

beforeEach(() => {
  jest.useFakeTimers()
  FakeEventSource.instances = []
  ;(global as unknown as { EventSource: unknown }).EventSource = FakeEventSource
  global.fetch = fetchMock as unknown as typeof fetch
  fetchMock.mockReset()
  // By default nothing changed on the server.
  fetchMock.mockResolvedValue({
    ok: true,
    status: 304,
    headers: { get: () => null },
  })
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  })
})

afterEach(() => {
  jest.useRealTimers()
  FakeEventSource.uninstall()
})

describe("backoffDelay", () => {
  it("doubles from 1 s up to 30 s, with at most 25% jitter", () => {
    expect(
      [1, 2, 3, 4, 5, 6, 7, 20].map((n) => backoffDelay(n, () => 0))
    ).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000])
    expect(backoffDelay(1, () => 1)).toBe(1250)
  })
})

describe("useDraftStream", () => {
  it("connects with the seq of the rendered snapshot and goes live on open", () => {
    const { result } = setup()
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.last.url).toBe(
      "/api/events/event-1/draft/stream?since=2"
    )
    expect(result.current.connection).toBe("connecting")
    act(() => FakeEventSource.last.open())
    expect(result.current.connection).toBe("live")
  })

  it("applies pushed events once, whatever the repeats", () => {
    const { result } = setup()
    act(() => FakeEventSource.last.open())
    emitDraft(pickEvent(1))
    emitDraft(pickEvent(1))
    expect(result.current.live.state.picks).toHaveLength(1)
    expect(result.current.live.state.lastSeq).toBe(3)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refetches the snapshot when an event leaves a gap", async () => {
    const full = snapshotOf([
      created,
      started,
      pickEvent(1),
      pickEvent(2),
      pickEvent(3),
    ])
    fetchMock.mockResolvedValue(jsonResponse({ draft: full }))
    const { result } = setup()
    act(() => FakeEventSource.last.open())

    // Pick 3 arrives without 1 and 2.
    await act(async () => FakeEventSource.last.emit("draft", pickEvent(3)))
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events/event-1/draft/state",
      expect.anything()
    )
    expect(result.current.live.state.currentPickNo).toBe(4)
    expect(result.current.live.needsResync).toBe(false)
  })

  it("takes a reset snapshot from the stream", () => {
    const { result } = setup()
    act(() => FakeEventSource.last.open())
    const later = snapshotOf([created, started, pickEvent(1), pickEvent(2)])
    act(() => FakeEventSource.last.emit("reset", { draft: later }))
    expect(result.current.live.state.currentPickNo).toBe(3)
  })

  it("reconnects at once after bye(cap), staying live", () => {
    const { result } = setup()
    act(() => FakeEventSource.last.open())
    emitDraft(pickEvent(1))
    const first = FakeEventSource.last
    act(() => first.emit("bye", { reason: "cap" }))
    expect(first.closed).toBe(true)
    expect(FakeEventSource.instances).toHaveLength(2)
    // The new stream resumes after what was seen.
    expect(FakeEventSource.last.url).toMatch(/since=3$/)
    act(() => FakeEventSource.last.open())
    expect(result.current.connection).toBe("live")
  })

  it("backs off after errors, then polls, and recovers when a stream opens", async () => {
    const { result } = setup()
    act(() => FakeEventSource.last.open())

    // Failure 1 and 2: reconnecting.
    act(() => FakeEventSource.last.fail())
    expect(result.current.connection).toBe("reconnecting")
    await advance(1300)
    expect(FakeEventSource.instances).toHaveLength(2)
    act(() => FakeEventSource.last.fail())
    expect(result.current.connection).toBe("reconnecting")
    await advance(2600)
    expect(FakeEventSource.instances).toHaveLength(3)

    // Failure 3: polling, and the poll applies events from the state endpoint.
    act(() => FakeEventSource.last.fail())
    expect(result.current.connection).toBe("polling")
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          draft: { id: "draft-1", status: "in_progress", version: 2 },
          seq: 3,
          events: [pickEvent(1)],
        },
        '"etag-1"'
      )
    )
    await advance(POLL_INTERVAL_MS)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events/event-1/draft/state?since=2",
      expect.objectContaining({ headers: {} })
    )
    expect(result.current.live.state.picks).toHaveLength(1)

    // The next poll sends the ETag it got.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 304,
      headers: { get: () => null },
    })
    await advance(POLL_INTERVAL_MS)
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/events/event-1/draft/state?since=3",
      expect.objectContaining({ headers: {} })
    )

    // A stream that opens again ends the fallback.
    await advance(30_000)
    act(() => FakeEventSource.last.open())
    expect(result.current.connection).toBe("live")
    fetchMock.mockClear()
    await advance(POLL_INTERVAL_MS * 2)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("treats a stream that never opens as failed", async () => {
    const { result } = setup()
    await advance(10_500)
    expect(FakeEventSource.instances[0]!.closed).toBe(true)
    expect(result.current.connection).toBe("reconnecting")
  })

  it("polls when EventSource does not exist", async () => {
    FakeEventSource.uninstall()
    fetchMock.mockResolvedValue(
      jsonResponse({
        draft: { id: "draft-1", status: "in_progress", version: 2 },
        seq: 3,
        events: [pickEvent(1)],
      })
    )
    const { result } = setup()
    expect(result.current.connection).toBe("polling")
    await advance(POLL_INTERVAL_MS)
    expect(result.current.live.state.picks).toHaveLength(1)
  })

  it("does not poll while the tab is hidden", async () => {
    FakeEventSource.uninstall()
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    })
    setup()
    await advance(POLL_INTERVAL_MS * 3)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("adopts a newer snapshot from the server and ignores an older one", () => {
    const { result, rerender } = setup()
    emitDraft(pickEvent(1))
    // router.refresh() brings a snapshot that is behind: ignored.
    rerender({ snapshot: snapshotOf([created, started]) })
    expect(result.current.live.state.picks).toHaveLength(1)
    // One that is ahead replaces the state.
    rerender({
      snapshot: snapshotOf([created, started, pickEvent(1), pickEvent(2)]),
    })
    expect(result.current.live.state.picks).toHaveLength(2)
  })

  it("sync() fetches the events after lastSeq and returns them", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        draft: { id: "draft-1", status: "in_progress", version: 2 },
        seq: 3,
        events: [pickEvent(1)],
      })
    )
    const { result } = setup()
    let events: DraftLogEvent[] = []
    await act(async () => {
      events = await result.current.sync()
    })
    expect(events).toHaveLength(1)
    expect(result.current.live.state.picks).toHaveLength(1)
  })

  it("stops all traffic once the draft is cancelled", () => {
    const { result } = setup()
    act(() => FakeEventSource.last.open())
    const source = FakeEventSource.last
    emitDraft({
      seq: 10,
      type: "cancelled",
      actorUserId: "manager",
      at: "2026-01-01T00:00:00.000Z",
      payload: { deletedTeamIds: [], keptTeamIds: [] },
    })
    expect(result.current.live.state.status).toBe("cancelled")
    expect(result.current.active).toBe(false)
    expect(source.closed).toBe(true)
  })
})
