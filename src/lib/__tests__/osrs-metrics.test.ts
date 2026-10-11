import {
  getMetricIds,
  getMetricName,
  getWikiIconUrl,
} from "@/lib/osrs-metrics"

describe("getMetricIds", () => {
  it("returns the Wise Old Man ids of each metric type", () => {
    expect(getMetricIds("skill")).toEqual(
      expect.arrayContaining(["woodcutting", "overall", "runecrafting"])
    )
    expect(getMetricIds("boss")).toEqual(
      expect.arrayContaining(["zulrah", "vorkath"])
    )
    expect(getMetricIds("activity")).toEqual(
      expect.arrayContaining(["clue_scrolls_all", "league_points"])
    )
  })

  it("keeps the types apart", () => {
    expect(getMetricIds("skill")).not.toContain("zulrah")
    expect(getMetricIds("boss")).not.toContain("woodcutting")
  })

  it("returns nothing for an unknown type", () => {
    expect(getMetricIds("pet")).toEqual([])
  })
})

describe("getWikiIconUrl", () => {
  it("uses the wiki's skill icons", () => {
    expect(getWikiIconUrl("woodcutting")).toBe(
      "https://oldschool.runescape.wiki/images/Woodcutting_icon.png"
    )
  })

  it("uses the wiki's own name for the Runecraft icon", () => {
    expect(getWikiIconUrl("runecrafting")).toBe(
      "https://oldschool.runescape.wiki/images/Runecraft_icon.png"
    )
  })

  it("keeps a display name for every skill", () => {
    for (const skill of getMetricIds("skill")) {
      expect(getMetricName(skill)).not.toBe("")
    }
  })
})
