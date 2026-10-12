import type { OsrsItem } from "@/types/osrs-items"
import { indexOsrsItems } from "@/lib/osrs-item-ranking"
import {
  createItemResolver,
  MAX_CANDIDATES,
  normalizeItemName,
} from "@/lib/osrs-item-resolve"

let nextId = 1
/** Builds an item the way the osrs-item-data package stores it: "Name#variant". */
function item(name: string, id: number | number[] = nextId++): OsrsItem {
  const [baseName = name, variant] = name.split("#")
  return {
    id,
    name,
    baseName,
    ...(variant ? { variant } : {}),
    imageUrl: `/${encodeURIComponent(name)}.png`,
  }
}

const WHIP = item("Abyssal whip")
const BONES = item("Dragon bones")
const BIG_BONES = item("Big bones")
const DRAGON_BOOTS = item("Dragon boots")
const TENTACLE = item("Abyssal tentacle")
const KRAKEN_TENTACLE = item("Kraken tentacle")
const FANG = item("Zulrah's fang")
const LONGSWORD = item("3rd age longsword")
const DDS_P = item("Dragon dagger#(p)")
const DDS_PP = item("Dragon dagger#(p+)")
const DDS_PPP = item("Dragon dagger#(p++)")
const DDS_UNP = item("Dragon dagger#(unp)")
const GLORY = ["1", "2", "3", "4", "5", "6", "Uncharged"].map((v) =>
  item(`Amulet of glory#${v}`)
)
const GLORY_4 = GLORY[3]!
const BRAEWE = item("Super combat potion#(4)")
// Two different items that are called the same.
const MASK_A = item("Black mask (i)#(1)")
const MASK_B = item("Black mask (i)#(1)")
// A plain item that is also the base name of variants.
const BLACK_MASK = item("Black mask")
const BLACK_MASK_10 = item("Black mask#(10)")
const RANGER_BOOTS = item("Ranger boots")
const DRAGON_RANGER = item("Dragon ranger hat")
const SCALES = item("Zulrah's scales")

const ITEMS = [
  WHIP,
  BONES,
  BIG_BONES,
  DRAGON_BOOTS,
  TENTACLE,
  KRAKEN_TENTACLE,
  FANG,
  LONGSWORD,
  DDS_P,
  DDS_PP,
  DDS_PPP,
  DDS_UNP,
  ...GLORY,
  BRAEWE,
  MASK_A,
  MASK_B,
  BLACK_MASK,
  BLACK_MASK_10,
  RANGER_BOOTS,
  DRAGON_RANGER,
  SCALES,
]

const resolver = createItemResolver(indexOsrsItems(ITEMS))
const resolve = (name: string, quantity = 1) =>
  resolver.resolve({ name, quantity })

describe("normalizeItemName", () => {
  it.each([
    ["Abyssal whip", "abyssal whip"],
    ["  ABYSSAL   WHIP ", "abyssal whip"],
    ["Zulrah's fang", "zulrahs fang"],
    ["Zulrah’s fang", "zulrahs fang"],
    ["Dragon dagger#(p++)", "dragon dagger p++"],
    ["Dragon dagger(p++)", "dragon dagger p++"],
    ["Amulet of glory(4)", "amulet of glory 4"],
    ["Amulet of glory#4", "amulet of glory 4"],
    ["Dragon-hide body", "dragon hide body"],
    ["Café au lait", "cafe au lait"],
    ["3rd age longsword", "3rd age longsword"],
    ["?!", ""],
  ])("turns %j into %j", (name, expected) => {
    expect(normalizeItemName(name)).toBe(expected)
  })
})

describe("createItemResolver", () => {
  describe("exact names", () => {
    it("matches a name ignoring case, spacing and punctuation", () => {
      expect(resolve("abyssal   WHIP").item).toBe(WHIP)
      expect(resolve("zulrahs fang").item).toBe(FANG)
      expect(resolve("Zulrah’s Fang").item).toBe(FANG)
      expect(resolve("3RD AGE longsword").item).toBe(LONGSWORD)
    })

    it("reports a match with the item, the input and the quantity", () => {
      expect(resolve("Abyssal whip", 3)).toEqual({
        input: "Abyssal whip",
        quantity: 3,
        status: "matched",
        item: WHIP,
      })
    })

    it("matches a variant written with or without a space before the parenthesis", () => {
      expect(resolve("Dragon dagger(p++)").item).toBe(DDS_PPP)
      expect(resolve("Dragon dagger (p++)").item).toBe(DDS_PPP)
      expect(resolve("dragon dagger#(p+)").item).toBe(DDS_PP)
      expect(resolve("Amulet of glory(4)").item).toBe(GLORY_4)
      expect(resolve("Amulet of glory 4").item).toBe(GLORY_4)
    })

    it("does not mix up variants that differ only by a plus", () => {
      expect(resolve("Dragon dagger (p)").item).toBe(DDS_P)
      expect(resolve("Dragon dagger (p+)").item).toBe(DDS_PP)
    })

    it("is ambiguous when several items have the exact name", () => {
      const result = resolve("Black mask (i) (1)")
      expect(result.status).toBe("ambiguous")
      expect(result.item).toBeUndefined()
      expect(result.candidates).toEqual([MASK_A, MASK_B])
    })

    it("prefers the plain item over the variants that share its base name", () => {
      expect(resolve("Black mask").item).toBe(BLACK_MASK)
    })
  })

  describe("variants of one base name", () => {
    it("is ambiguous when only variants exist, listing them shortest name first", () => {
      const result = resolve("Amulet of glory")
      expect(result.status).toBe("ambiguous")
      expect(result.candidates).toEqual(GLORY.slice(0, MAX_CANDIDATES))
    })

    it("lists at most five candidates", () => {
      expect(resolve("Amulet of glory").candidates).toHaveLength(5)
      expect(resolve("Dragon dagger").candidates).toHaveLength(4)
    })

    it("matches a base name that has a single variant", () => {
      expect(resolve("Super combat potion").item).toBe(BRAEWE)
    })
  })

  describe("ranking", () => {
    it("accepts the only item that contains every word", () => {
      expect(resolve("scales")).toMatchObject({
        status: "matched",
        item: SCALES,
      })
    })

    it("accepts a top hit that is decisively better than the runner-up", () => {
      // "Ranger boots" starts with the query; "Dragon ranger hat" only has it as a later word.
      const result = resolve("ranger")
      expect(result.status).toBe("matched")
      expect(result.item).toBe(RANGER_BOOTS)
    })

    it("is ambiguous when the best hits are equally good", () => {
      const result = resolve("tentacle")
      expect(result.status).toBe("ambiguous")
      expect(result.candidates).toEqual(
        expect.arrayContaining([TENTACLE, KRAKEN_TENTACLE])
      )
    })

    it("is ambiguous for a prefix that fits several items", () => {
      const result = resolve("dragon b")
      expect(result.status).toBe("ambiguous")
      expect(result.candidates).toEqual(
        expect.arrayContaining([BONES, DRAGON_BOOTS])
      )
    })

    it("needs every word to appear, in any order", () => {
      expect(resolve("whip abyssal").item).toBe(WHIP)
    })

    it("lists at most five candidates", () => {
      const many = Array.from({ length: 9 }, (_, i) => item(`Rune thing ${i}`))
      const result = createItemResolver(indexOsrsItems(many)).resolve({
        name: "rune",
        quantity: 1,
      })
      expect(result.status).toBe("ambiguous")
      expect(result.candidates).toHaveLength(MAX_CANDIDATES)
    })
  })

  describe("unmatched", () => {
    it.each([["Nonexistent thing"], ["Abysal whip"], ["?!"], ["   "]])(
      "finds nothing for %j",
      (name) => {
        const result = resolve(name, 2)
        expect(result).toMatchObject({ status: "unmatched", quantity: 2 })
        expect(result.item).toBeUndefined()
        expect(result.candidates).toBeUndefined()
      }
    )
  })

  describe("alternative readings", () => {
    it("prefers the reading that is an exact item", () => {
      // "(4)" is part of the name, not a quantity of 4.
      expect(
        resolver.resolve({
          name: "Amulet of glory",
          quantity: 4,
          alternatives: [{ name: "Amulet of glory(4)", quantity: 1 }],
        })
      ).toEqual({
        input: "Amulet of glory(4)",
        quantity: 1,
        status: "matched",
        item: GLORY_4,
      })
    })

    it("keeps the quantity reading when the whole text is not an item", () => {
      expect(
        resolver.resolve({
          name: "Dragon bones",
          quantity: 3,
          alternatives: [{ name: "Dragon bones (3)", quantity: 1 }],
        })
      ).toEqual({
        input: "Dragon bones",
        quantity: 3,
        status: "matched",
        item: BONES,
      })
    })

    it("uses the alternative when the primary reading finds nothing", () => {
      expect(
        resolver.resolve({
          name: "Dragon bones 3",
          quantity: 1,
          alternatives: [{ name: "Dragon bones", quantity: 3 }],
        })
      ).toMatchObject({ input: "Dragon bones", quantity: 3, item: BONES })
    })

    it("prefers a unique match over several candidates", () => {
      const result = resolver.resolve({
        name: "Dragon dagger",
        quantity: 1,
        alternatives: [{ name: "Dragon dagger(p++)", quantity: 2 }],
      })
      expect(result).toMatchObject({ item: DDS_PPP, quantity: 2 })
    })

    it("keeps the primary reading on a tie", () => {
      // Both "Black mask" and "Black mask (10)" are items; the quantity reading comes first.
      expect(
        resolver.resolve({
          name: "Black mask",
          quantity: 10,
          alternatives: [{ name: "Black mask (10)", quantity: 1 }],
        })
      ).toMatchObject({ input: "Black mask", quantity: 10, item: BLACK_MASK })
    })

    it("reports the primary reading when nothing resolves", () => {
      expect(
        resolver.resolve({
          name: "Nonexistent",
          quantity: 5,
          alternatives: [{ name: "Also nonexistent", quantity: 1 }],
        })
      ).toMatchObject({
        input: "Nonexistent",
        quantity: 5,
        status: "unmatched",
      })
    })
  })
})
