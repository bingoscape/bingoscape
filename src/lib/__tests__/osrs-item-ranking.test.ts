import { indexOsrsItems, rankOsrsItems } from "@/lib/osrs-item-ranking"
import type { OsrsItem } from "@/types/osrs-items"

const item = (name: string, id: number): OsrsItem => {
  const [baseName = name, variant] = name.split("#")
  return {
    id,
    name,
    baseName,
    variant,
    imageUrl: "",
  } as OsrsItem
}

const search = (items: OsrsItem[], query: string, limit = 20) =>
  rankOsrsItems(indexOsrsItems(items), query, limit).map((i) => i.name)

describe("rankOsrsItems", () => {
  it("returns the exact match first even when it would fall outside the limit", () => {
    const filler = Array.from({ length: 30 }, (_, i) =>
      item(`Blessed type${i} bones`, 1000 + i)
    )
    const items = [...filler, item("Bones", 526), item("Big bones", 532)]

    const results = search(items, "bones", 5)

    expect(results[0]).toBe("Bones")
  })

  it("orders exact, prefix, word prefix, then substring matches", () => {
    const items = [
      item("Superbones", 1),
      item("Bonesack", 5),
      item("Big bones", 2),
      item("Bones (Ape Atoll)", 3),
      item("Bones", 4),
    ]

    expect(search(items, "bones")).toEqual([
      "Bones",
      "Bones (Ape Atoll)",
      "Bonesack",
      "Big bones",
      "Superbones",
    ])
  })

  it("requires every word but accepts them in any order", () => {
    const items = [item("Dragon bones", 1), item("Dragon scimitar", 2)]

    expect(search(items, "bones dragon")).toEqual(["Dragon bones"])
  })

  it("ignores surrounding and repeated whitespace and case", () => {
    const items = [item("Dragon bones", 1)]

    expect(search(items, "  DRAGON   bones ")).toEqual(["Dragon bones"])
  })

  it("lists the plain item before its variants and keeps variants searchable", () => {
    const items = [
      item("Absorption#(1)", 1),
      item("Absorption#(2)", 2),
      item("Absorption", 3),
    ]

    expect(search(items, "absorption")[0]).toBe("Absorption")
    expect(search(items, "(2)")).toEqual(["Absorption#(2)"])
  })

  it("returns nothing for an empty query and respects the limit", () => {
    const items = [item("Bones", 1), item("Big bones", 2)]

    expect(search(items, "   ")).toEqual([])
    expect(search(items, "bones", 1)).toEqual(["Bones"])
  })
})
