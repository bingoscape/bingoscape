import { act, renderHook } from "@testing-library/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  buildWorkspaceUrl,
  parseWorkspaceParams,
  useWorkspaceParams,
} from "@/components/event-workspace/use-workspace-params"

const PATH = "/events/e1"

describe("parseWorkspaceParams", () => {
  it("defaults to the tile panel with nothing selected", () => {
    expect(parseWorkspaceParams(new URLSearchParams(""))).toEqual({
      board: null,
      tile: null,
      panel: "tile",
      teamId: null,
      filter: null,
      view: null,
    })
  })

  it("reads board, tile, panel and teamId", () => {
    const p = parseWorkspaceParams(
      new URLSearchParams("board=b1&tile=t1&panel=teams&teamId=team9")
    )
    expect(p).toEqual({
      board: "b1",
      tile: "t1",
      panel: "teams",
      teamId: "team9",
      filter: null,
      view: null,
    })
  })

  it("reads the goal setup view and ignores unknown views", () => {
    expect(parseWorkspaceParams(new URLSearchParams("view=goals")).view).toBe(
      "goals"
    )
    expect(
      parseWorkspaceParams(new URLSearchParams("view=nope")).view
    ).toBeNull()
    expect(parseWorkspaceParams(new URLSearchParams("view=")).view).toBeNull()
  })

  it("reads a known filter and ignores unknown ones", () => {
    expect(
      parseWorkspaceParams(new URLSearchParams("filter=attention")).filter
    ).toBe("attention")
    expect(
      parseWorkspaceParams(new URLSearchParams("filter=nope")).filter
    ).toBeNull()
  })

  it("falls back to the tile panel for unknown values", () => {
    expect(parseWorkspaceParams(new URLSearchParams("panel=nope")).panel).toBe(
      "tile"
    )
  })
})

describe("buildWorkspaceUrl", () => {
  it("sets and removes keys, preserving unrelated params", () => {
    expect(
      buildWorkspaceUrl(PATH, "foo=1&board=b1", { tile: "t1", panel: "tile" })
    ).toBe(`${PATH}?foo=1&board=b1&tile=t1`)
    expect(buildWorkspaceUrl(PATH, "board=b1&tile=t1", { tile: null })).toBe(
      `${PATH}?board=b1`
    )
  })

  it("does not write the default panel", () => {
    expect(buildWorkspaceUrl(PATH, "panel=teams", { panel: "tile" })).toBe(PATH)
    expect(buildWorkspaceUrl(PATH, "", { panel: "prize" })).toBe(
      `${PATH}?panel=prize`
    )
  })

  it("sets and clears the view, keeping the rest", () => {
    expect(buildWorkspaceUrl(PATH, "board=b1", { view: "goals" })).toBe(
      `${PATH}?board=b1&view=goals`
    )
    expect(buildWorkspaceUrl(PATH, "board=b1&view=goals", { view: null })).toBe(
      `${PATH}?board=b1`
    )
  })

  it("leaves untouched keys alone when the patch omits them", () => {
    expect(buildWorkspaceUrl(PATH, "tile=t1&teamId=x", { board: "b2" })).toBe(
      `${PATH}?tile=t1&teamId=x&board=b2`
    )
  })
})

describe("useWorkspaceParams", () => {
  const replace = jest.fn()
  let pushState: jest.SpyInstance
  let replaceState: jest.SpyInstance

  function mockUrl(query: string) {
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(query))
    ;(usePathname as jest.Mock).mockReturnValue(PATH)
    ;(useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace,
      prefetch: jest.fn(),
    })
  }

  beforeEach(() => {
    replace.mockReset()
    pushState = jest.spyOn(window.history, "pushState").mockImplementation()
    replaceState = jest
      .spyOn(window.history, "replaceState")
      .mockImplementation()
  })

  afterEach(() => {
    pushState.mockRestore()
    replaceState.mockRestore()
  })

  it("exposes the parsed params", () => {
    mockUrl("board=b1&tile=t1&panel=info&teamId=x")
    const { result } = renderHook(() => useWorkspaceParams())
    expect(result.current.params).toEqual({
      board: "b1",
      tile: "t1",
      panel: "info",
      teamId: "x",
      filter: null,
      view: null,
    })
  })

  it("setView pushes a history entry (Back returns to the Board) and keeps other params", () => {
    mockUrl("board=b1&tile=t1")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.setView("goals"))
    expect(pushState).toHaveBeenCalledWith(
      null,
      "",
      `${PATH}?board=b1&tile=t1&view=goals`
    )
    expect(replaceState).not.toHaveBeenCalled()
  })

  it("setView(null) removes the view", () => {
    mockUrl("board=b1&view=goals")
    const { result } = renderHook(() => useWorkspaceParams())
    expect(result.current.params.view).toBe("goals")
    act(() => result.current.setView(null))
    expect(pushState).toHaveBeenCalledWith(null, "", `${PATH}?board=b1`)
  })

  it("setView does nothing when the view is already shown", () => {
    mockUrl("view=goals")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.setView("goals"))
    expect(pushState).not.toHaveBeenCalled()
  })

  it("selecting a Tile keeps the goal setup view", () => {
    mockUrl("view=goals")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.selectTile("t1"))
    expect(pushState).toHaveBeenCalledWith(
      null,
      "",
      `${PATH}?view=goals&tile=t1`
    )
  })

  it("switching Board keeps the goal setup view", () => {
    mockUrl("board=b1&view=goals")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.setBoard("b2"))
    expect(replace).toHaveBeenCalledWith(`${PATH}?board=b2&view=goals`, {
      scroll: false,
    })
  })

  it("setFilter replaces history and keeps other params", () => {
    mockUrl("board=b1&tile=t1")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.setFilter("incomplete"))
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      `${PATH}?board=b1&tile=t1&filter=incomplete`
    )
    expect(pushState).not.toHaveBeenCalled()
  })

  it("selecting a first Tile pushes a history entry (Back deselects)", () => {
    mockUrl("board=b1")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.selectTile("t1"))
    expect(pushState).toHaveBeenCalledWith(null, "", `${PATH}?board=b1&tile=t1`)
    expect(replaceState).not.toHaveBeenCalled()
  })

  it("switching between Tiles replaces the entry", () => {
    mockUrl("tile=t1")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.selectTile("t2"))
    expect(replaceState).toHaveBeenCalledWith(null, "", `${PATH}?tile=t2`)
    expect(pushState).not.toHaveBeenCalled()
  })

  it("selecting a Tile jumps to the tile panel", () => {
    mockUrl("panel=teams")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.selectTile("t1"))
    expect(pushState).toHaveBeenCalledWith(null, "", `${PATH}?tile=t1`)
  })

  it("clearing the selection removes ?tile without a new entry", () => {
    mockUrl("board=b1&tile=t1")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.selectTile(null))
    expect(replaceState).toHaveBeenCalledWith(null, "", `${PATH}?board=b1`)
    expect(pushState).not.toHaveBeenCalled()
  })

  it("does nothing when re-selecting the selected Tile", () => {
    mockUrl("tile=t1")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.selectTile("t1"))
    expect(pushState).not.toHaveBeenCalled()
    expect(replaceState).not.toHaveBeenCalled()
  })

  it("changing the panel pushes history and keeps the Tile", () => {
    mockUrl("tile=t1")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.setPanel("prize"))
    expect(pushState).toHaveBeenCalledWith(
      null,
      "",
      `${PATH}?tile=t1&panel=prize`
    )
  })

  it("switching Board replaces the route, clears the Tile and keeps the Team", () => {
    mockUrl("board=b1&tile=t1&teamId=x&panel=teams")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.setBoard("b2"))
    expect(replace).toHaveBeenCalledWith(`${PATH}?board=b2&teamId=x`, {
      scroll: false,
    })
  })

  it("setting and clearing the viewed Team replaces the route", () => {
    mockUrl("board=b1")
    const { result } = renderHook(() => useWorkspaceParams())
    act(() => result.current.setTeamId("team7"))
    expect(replace).toHaveBeenCalledWith(`${PATH}?board=b1&teamId=team7`, {
      scroll: false,
    })
    act(() => result.current.setTeamId(null))
    expect(replace).toHaveBeenLastCalledWith(`${PATH}?board=b1`, {
      scroll: false,
    })
  })
})
