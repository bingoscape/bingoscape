import { act, renderHook } from "@testing-library/react"
import { searchOsrsItems } from "@/app/actions/osrs-items"
import {
  ITEM_SEARCH_LIMIT,
  useOsrsItemSearch,
} from "@/hooks/use-osrs-item-search"
import type { OsrsItem } from "@/types/osrs-items"

jest.mock("@/app/actions/osrs-items", () => ({ searchOsrsItems: jest.fn() }))

const mockedSearch = searchOsrsItems as jest.MockedFunction<
  typeof searchOsrsItems
>

type SearchResult = Awaited<ReturnType<typeof searchOsrsItems>>

const item = (id: number, name: string): OsrsItem => ({
  id,
  name,
  baseName: name,
  imageUrl: `/${id}.png`,
})
const whip = item(4151, "Abyssal whip")
const dagger = item(1215, "Dragon dagger")

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** Runs the debounce timer and lets the search promise settle. */
const flushSearch = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(300)
  })

describe("useOsrsItemSearch", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    // Reset, not just clear: leftover mockReturnValueOnce queues must not leak.
    mockedSearch.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("does not search for fewer than two characters", async () => {
    const { result } = renderHook(() => useOsrsItemSearch(" a "))

    await flushSearch()

    expect(mockedSearch).not.toHaveBeenCalled()
    expect(result.current).toEqual({
      ready: false,
      loading: false,
      items: [],
      failed: false,
    })
  })

  it("is loading right away, then returns the results after the debounce", async () => {
    mockedSearch.mockResolvedValue({ success: true, items: [whip] })
    const { result } = renderHook(() => useOsrsItemSearch("whip"))

    expect(result.current.ready).toBe(true)
    expect(result.current.loading).toBe(true)
    expect(mockedSearch).not.toHaveBeenCalled()

    await flushSearch()

    expect(mockedSearch).toHaveBeenCalledWith("whip", ITEM_SEARCH_LIMIT)
    expect(result.current).toEqual({
      ready: true,
      loading: false,
      items: [whip],
      failed: false,
    })
  })

  it("asks for 30 results unless told otherwise", async () => {
    mockedSearch.mockResolvedValue({ success: true, items: [] })
    renderHook(() => useOsrsItemSearch("whip"))
    await flushSearch()
    expect(mockedSearch).toHaveBeenLastCalledWith("whip", 30)

    renderHook(() => useOsrsItemSearch("dagger", 5))
    await flushSearch()
    expect(mockedSearch).toHaveBeenLastCalledWith("dagger", 5)
  })

  it("trims the query before searching", async () => {
    mockedSearch.mockResolvedValue({ success: true, items: [] })
    renderHook(() => useOsrsItemSearch("  whip  "))

    await flushSearch()

    expect(mockedSearch).toHaveBeenCalledWith("whip", ITEM_SEARCH_LIMIT)
  })

  it("searches only once for a burst of typing", async () => {
    mockedSearch.mockResolvedValue({ success: true, items: [whip] })
    const { rerender } = renderHook(
      ({ query }) => useOsrsItemSearch(query),
      { initialProps: { query: "ab" } }
    )

    await act(async () => {
      await jest.advanceTimersByTimeAsync(100)
    })
    rerender({ query: "aby" })
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100)
    })
    rerender({ query: "abyssal" })
    await flushSearch()

    expect(mockedSearch).toHaveBeenCalledTimes(1)
    expect(mockedSearch).toHaveBeenCalledWith("abyssal", ITEM_SEARCH_LIMIT)
  })

  it("drops the response of a superseded query", async () => {
    const first = deferred<SearchResult>()
    const second = deferred<SearchResult>()
    mockedSearch
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { result, rerender } = renderHook(
      ({ query }) => useOsrsItemSearch(query),
      { initialProps: { query: "whip" } }
    )

    await flushSearch() // the search for "whip" is now in flight
    rerender({ query: "dagger" })
    await flushSearch() // and so is the one for "dagger"

    // The slow first response arrives last and must not win.
    await act(async () => {
      second.resolve({ success: true, items: [dagger] })
      first.resolve({ success: true, items: [whip] })
    })

    expect(result.current.items).toEqual([dagger])
    expect(result.current.loading).toBe(false)
  })

  it("keeps the previous results on screen while the next query loads", async () => {
    mockedSearch.mockResolvedValueOnce({ success: true, items: [whip] })
    const { result, rerender } = renderHook(
      ({ query }) => useOsrsItemSearch(query),
      { initialProps: { query: "whip" } }
    )
    await flushSearch()

    rerender({ query: "dagger" })

    expect(result.current.loading).toBe(true)
    expect(result.current.items).toEqual([whip])
  })

  it("drops the results when the query becomes too short", async () => {
    mockedSearch.mockResolvedValue({ success: true, items: [whip] })
    const { result, rerender } = renderHook(
      ({ query }) => useOsrsItemSearch(query),
      { initialProps: { query: "whip" } }
    )
    await flushSearch()

    rerender({ query: "w" })

    expect(result.current).toEqual({
      ready: false,
      loading: false,
      items: [],
      failed: false,
    })
  })

  it("reports a failed search", async () => {
    mockedSearch.mockResolvedValue({ success: false, error: "Nope" })
    const { result } = renderHook(() => useOsrsItemSearch("whip"))

    await flushSearch()

    expect(result.current.failed).toBe(true)
    expect(result.current.loading).toBe(false)
    expect(result.current.items).toEqual([])
  })

  it("reports a search that throws, and logs it", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined)
    mockedSearch.mockRejectedValue(new Error("network"))
    const { result } = renderHook(() => useOsrsItemSearch("whip"))

    await flushSearch()

    expect(result.current.failed).toBe(true)
    expect(result.current.items).toEqual([])
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it("does not report an old failure for a new query", async () => {
    mockedSearch.mockResolvedValueOnce({ success: false, error: "Nope" })
    const { result, rerender } = renderHook(
      ({ query }) => useOsrsItemSearch(query),
      { initialProps: { query: "whip" } }
    )
    await flushSearch()
    expect(result.current.failed).toBe(true)

    rerender({ query: "dagger" })

    expect(result.current.failed).toBe(false)
  })
})
