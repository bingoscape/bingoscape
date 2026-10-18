import { getOptimizedImageUrl } from "@/lib/utils"

describe("getOptimizedImageUrl", () => {
  it("falls back to the placeholder for an empty value", () => {
    expect(getOptimizedImageUrl(null)).toBe("/placeholder.svg")
    expect(getOptimizedImageUrl(undefined)).toBe("/placeholder.svg")
    expect(getOptimizedImageUrl("")).toBe("/placeholder.svg")
  })

  it("routes uploads through /api", () => {
    expect(getOptimizedImageUrl("/uploads/a.png")).toBe("/api/uploads/a.png")
  })

  it("serves OSRS Wiki images through the cache route", () => {
    expect(
      getOptimizedImageUrl(
        "https://oldschool.runescape.wiki/images/thumb/Sue.png/290px-Sue.png?290bd"
      )
    ).toBe("/api/osrs-image/thumb/Sue.png/290px-Sue.png")
  })

  it("leaves other URLs and already rewritten routes alone", () => {
    for (const url of [
      "https://cdn.discordapp.com/avatars/1/2.png",
      "https://runescape.wiki/images/thumb/Nex.png/800px-Nex.png",
      "/api/osrs-image/Great_Olm.png",
      "/api/uploads/a.png",
    ]) {
      expect(getOptimizedImageUrl(url)).toBe(url)
    }
  })
})
