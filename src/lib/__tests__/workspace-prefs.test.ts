import {
  COLLAPSED_SIDE_WIDTH,
  DEFAULT_WORKSPACE_PREFS,
  MIN_SIDE_WIDTH,
  clampSideWidth,
  parseWorkspacePrefs,
  serializeWorkspacePrefsCookie,
  sideWidthCss,
} from "@/lib/workspace-prefs"

const cookieValue = (
  prefs: Parameters<typeof serializeWorkspacePrefsCookie>[0]
) => serializeWorkspacePrefsCookie(prefs).split(";")[0]!.split("=")[1]

describe("clampSideWidth", () => {
  it("never goes below the minimum", () => {
    expect(clampSideWidth(100, 1600)).toBe(MIN_SIDE_WIDTH)
  })

  it("caps at 60% of the container", () => {
    expect(clampSideWidth(2000, 1000)).toBe(600)
  })

  it("keeps the minimum when the container is tiny", () => {
    expect(clampSideWidth(500, 400)).toBe(MIN_SIDE_WIDTH)
  })

  it("rounds to whole pixels", () => {
    expect(clampSideWidth(400.6, 1600)).toBe(401)
  })
})

describe("parseWorkspacePrefs", () => {
  it("defaults when the cookie is missing or malformed", () => {
    expect(parseWorkspacePrefs(undefined)).toEqual(DEFAULT_WORKSPACE_PREFS)
    expect(parseWorkspacePrefs("not json")).toEqual(DEFAULT_WORKSPACE_PREFS)
    expect(parseWorkspacePrefs("%7B")).toEqual(DEFAULT_WORKSPACE_PREFS)
    expect(parseWorkspacePrefs("null")).toEqual(DEFAULT_WORKSPACE_PREFS)
  })

  it("round-trips through the serialized cookie", () => {
    const prefs = { sideWidth: 512, collapsed: true, showOwnShips: true }
    expect(parseWorkspacePrefs(cookieValue(prefs))).toEqual(prefs)
  })

  it("keeps the own-ships toggle off by default and for anything but true", () => {
    expect(DEFAULT_WORKSPACE_PREFS.showOwnShips).toBe(false)
    expect(parseWorkspacePrefs(undefined).showOwnShips).toBe(false)
    // A cookie saved before the toggle existed.
    const legacy = encodeURIComponent(
      JSON.stringify({ sideWidth: 400, collapsed: false })
    )
    expect(parseWorkspacePrefs(legacy).showOwnShips).toBe(false)
    const text = encodeURIComponent(JSON.stringify({ showOwnShips: "yes" }))
    expect(parseWorkspacePrefs(text).showOwnShips).toBe(false)
    const on = encodeURIComponent(JSON.stringify({ showOwnShips: true }))
    expect(parseWorkspacePrefs(on).showOwnShips).toBe(true)
  })

  it("drops invalid widths but keeps the rest", () => {
    const raw = encodeURIComponent(
      JSON.stringify({ sideWidth: 12, collapsed: true })
    )
    expect(parseWorkspacePrefs(raw)).toEqual({
      sideWidth: null,
      collapsed: true,
      showOwnShips: false,
    })
    const text = encodeURIComponent(JSON.stringify({ sideWidth: "wide" }))
    expect(parseWorkspacePrefs(text)).toEqual(DEFAULT_WORKSPACE_PREFS)
  })
})

describe("serializeWorkspacePrefsCookie", () => {
  it("is a path-wide, long-lived, lax cookie", () => {
    const cookie = serializeWorkspacePrefsCookie(DEFAULT_WORKSPACE_PREFS)
    expect(cookie).toContain("path=/")
    expect(cookie).toContain("max-age=31536000")
    expect(cookie).toContain("samesite=lax")
  })
})

describe("sideWidthCss", () => {
  it("uses the responsive default until the user resizes", () => {
    expect(sideWidthCss(DEFAULT_WORKSPACE_PREFS)).toBe(
      "clamp(360px, 30vw, 480px)"
    )
  })

  it("re-clamps a saved width in CSS", () => {
    expect(
      sideWidthCss({ sideWidth: 500, collapsed: false, showOwnShips: false })
    ).toBe("min(60%, max(320px, 500px))")
  })

  it("collapses to the rail width", () => {
    expect(
      sideWidthCss({ sideWidth: 500, collapsed: true, showOwnShips: false })
    ).toBe(`${COLLAPSED_SIDE_WIDTH}px`)
  })
})
