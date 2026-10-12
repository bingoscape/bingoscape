import {
  MAX_ITEM_NAME_LENGTH,
  MAX_LIST_ENTRIES,
  parseItemList,
} from "@/lib/item-list-parse"

/** [name, quantity] of every entry, for compact assertions. */
function read(text: string) {
  return parseItemList(text).entries.map((e) => [e.name, e.quantity])
}

/** The only entry of a one-entry list. */
function single(text: string) {
  const { entries } = parseItemList(text)
  expect(entries).toHaveLength(1)
  return entries[0]!
}

describe("parseItemList", () => {
  describe("lines", () => {
    it("reads one entry per line with a quantity of 1", () => {
      expect(read("Abyssal whip\nDragon bones\nTwisted bow")).toEqual([
        ["Abyssal whip", 1],
        ["Dragon bones", 1],
        ["Twisted bow", 1],
      ])
    })

    it("accepts Windows and old Mac line endings", () => {
      expect(read("Abyssal whip\r\nDragon bones\rTwisted bow")).toEqual([
        ["Abyssal whip", 1],
        ["Dragon bones", 1],
        ["Twisted bow", 1],
      ])
    })

    it("ignores blank lines, whitespace-only lines and lines without a name", () => {
      const result = parseItemList(
        "\n  Abyssal whip  \n\n   \n\t\n-\n*\n1.\n•\nDragon bones\n"
      )
      expect(result.entries.map((e) => e.name)).toEqual([
        "Abyssal whip",
        "Dragon bones",
      ])
      expect(result.ignored).toBe(0)
    })

    it("returns nothing for empty text", () => {
      expect(parseItemList("")).toEqual({ entries: [], ignored: 0 })
    })

    it("keeps the original text of the line in raw", () => {
      expect(single("  3x Dragon bones ").raw).toBe("3x Dragon bones")
    })

    it("collapses inner whitespace and strips double quotes around a name", () => {
      expect(read('"Dragon   bones"')).toEqual([["Dragon bones", 1]])
      expect(read("“Dragon bones”")).toEqual([["Dragon bones", 1]])
    })
  })

  describe("bullets and numbering", () => {
    it.each([
      ["- Dragon bones"],
      ["* Dragon bones"],
      ["• Dragon bones"],
      ["– Dragon bones"],
      ["1. Dragon bones"],
      ["12) Dragon bones"],
      ["- [ ] Dragon bones"],
      ["* [x] Dragon bones"],
      ["[X] Dragon bones"],
      ["1. - Dragon bones"],
    ])("strips the lead-in of %j", (line) => {
      expect(read(line)).toEqual([["Dragon bones", 1]])
    })

    it("keeps a quantity that follows a bullet", () => {
      expect(read("- 3x Dragon bones")).toEqual([["Dragon bones", 3]])
      expect(read("1. Dragon bones x2")).toEqual([["Dragon bones", 2]])
    })

    it("does not mistake a quantity for numbering", () => {
      // "3 " has no dot, "2.5m " is a number with a fraction.
      expect(read("3 Dragon bones")).toEqual([["Dragon bones", 3]])
      expect(read("2.5m Coins")).toEqual([["Coins", 2_500_000]])
    })
  })

  describe("quantity forms", () => {
    it.each([
      ["3x Dragon bones"],
      ["3 x Dragon bones"],
      ["3X Dragon bones"],
      ["3 × Dragon bones"],
      ["3×Dragon bones"],
      ["3xDragon bones"],
      ["Dragon bones x3"],
      ["Dragon bones x 3"],
      ["Dragon bones X3"],
      ["Dragon bones ×3"],
      ["Dragon bones (3)"],
      ["Dragon bones (x3)"],
      ["Dragon bones( 3 )"],
      ["Dragon bones: 3"],
      ["Dragon bones : 3"],
      ["3 Dragon bones"],
      ["Dragon bones, 3"],
      ["Dragon bones,3"],
      ["Dragon bones\t3"],
      ["3, Dragon bones"],
      ["3\tDragon bones"],
    ])("reads %j as 3 Dragon bones", (line) => {
      expect(read(line)).toEqual([["Dragon bones", 3]])
    })

    it.each([
      ["1k Dragon bones", 1000],
      ["2.5m Coins", 2_500_000],
      ["Coins x1.5k", 1500],
      ["1b Coins", 1_000_000_000],
      ["1,000 Coins", 1000],
      ["Coins, 1,000", 1000],
      ["Coins (13,034,431)", 13_034_431],
      ["Coins x 500K", 500_000],
    ])("understands the shorthand in %j", (line, quantity) => {
      expect(single(line).quantity).toBe(quantity)
    })

    it("defaults the quantity to 1", () => {
      expect(single("Dragon bones").quantity).toBe(1)
    })

    it.each([
      ["0x Dragon bones"],
      ["Dragon bones x0"],
      ["1.5x Dragon bones"],
      ["Dragon bones (0)"],
      ["Dragon bones (1.5)"],
      ["3000000000 Dragon bones"],
    ])("does not take %j as a quantity (not a valid goal target)", (line) => {
      const entry = single(line)
      expect(entry.quantity).toBe(1)
      expect(entry.name).toContain("Dragon bones")
    })

    it("lets a quantity in the text win over a number in a neighbouring piece", () => {
      expect(read("3x Dragon bones, 5")).toEqual([["Dragon bones", 3]])
    })
  })

  describe("names with digits and parentheses", () => {
    it.each([
      ["Dragon dagger(p++)"],
      ["Dragon dagger (p++)"],
      ["Dragon dagger(p+)"],
      ["3rd age longsword"],
      ["1/3rds full jug"],
      ["10th birthday cape"],
      ["25th anniversary 5x5 hat"],
      ["18lb shot"],
      ["2h sword"],
      ["Bird nest (Wyson, 2006–2016)"],
      ["Clue scroll (easy)"],
    ])("leaves %j untouched", (name) => {
      const entry = single(name)
      expect(entry.name).toBe(name)
      expect(entry.quantity).toBe(1)
    })

    it("reads a quantity after such a name", () => {
      expect(read("3rd age longsword x2")).toEqual([["3rd age longsword", 2]])
      expect(read("Dragon dagger (p++) x2")).toEqual([
        ["Dragon dagger (p++)", 2],
      ])
      expect(read("Dragon dagger(p++), 3")).toEqual([["Dragon dagger(p++)", 3]])
    })

    it("only counts a leading number when a word follows it", () => {
      // The word after the number must start with a letter.
      expect(read("2 3rd age longsword")).toEqual([["2 3rd age longsword", 1]])
      expect(read("3 Dragon bones")).toEqual([["Dragon bones", 3]])
    })

    it("does not split at commas inside parentheses", () => {
      expect(read("Bird nest (Wyson, 2006–2016), 2")).toEqual([
        ["Bird nest (Wyson, 2006–2016)", 2],
      ])
    })

    it("offers the whole text as an alternative when a (4) could be part of the name", () => {
      const entry = single("Amulet of glory(4)")
      expect([entry.name, entry.quantity]).toEqual(["Amulet of glory", 4])
      expect(entry.alternatives).toEqual([
        { name: "Amulet of glory(4)", quantity: 1 },
      ])

      expect(single("Super combat potion (4)").alternatives).toEqual([
        { name: "Super combat potion (4)", quantity: 1 },
      ])
    })

    it("offers the whole text as an alternative for a leading number and a joined x", () => {
      expect(single("2 Xerician hat").alternatives).toEqual([
        { name: "2 Xerician hat", quantity: 1 },
      ])
      expect(single("3xDragon bones").alternatives).toEqual([
        { name: "3xDragon bones", quantity: 1 },
      ])
    })

    it("reads a trailing number as part of the name first, with the quantity as the alternative", () => {
      const entry = single("Amulet of glory 4")
      expect([entry.name, entry.quantity]).toEqual(["Amulet of glory 4", 1])
      expect(entry.alternatives).toEqual([
        { name: "Amulet of glory", quantity: 4 },
      ])
    })

    it("has no alternatives where the reading is certain", () => {
      expect(single("3x Dragon bones").alternatives).toEqual([])
      expect(single("Dragon bones x3").alternatives).toEqual([])
      expect(single("3 x Dragon bones").alternatives).toEqual([])
      expect(single("Dragon bones: 3").alternatives).toEqual([])
      expect(single("Dragon bones").alternatives).toEqual([])
      expect(single("Dragon bones, 3").alternatives).toEqual([])
    })
  })

  describe("commas and tabs", () => {
    it("splits a line at commas into several entries", () => {
      expect(read("Abyssal whip, Dragon warhammer, Twisted bow")).toEqual([
        ["Abyssal whip", 1],
        ["Dragon warhammer", 1],
        ["Twisted bow", 1],
      ])
    })

    it("splits a line at tabs", () => {
      expect(read("Abyssal whip\tDragon warhammer")).toEqual([
        ["Abyssal whip", 1],
        ["Dragon warhammer", 1],
      ])
    })

    it("gives a piece that is only a number to the entry before it", () => {
      expect(read("Dragon bones, 3, Abyssal whip, 2")).toEqual([
        ["Dragon bones", 3],
        ["Abyssal whip", 2],
      ])
      expect(read("Dragon bones\t3\tNotes")).toEqual([
        ["Dragon bones", 3],
        ["Notes", 1],
      ])
    })

    it("gives a leading number to the entry after it", () => {
      expect(read("3, Dragon bones, Abyssal whip")).toEqual([
        ["Dragon bones", 3],
        ["Abyssal whip", 1],
      ])
    })

    it("does not split a thousands separator", () => {
      expect(read("Coins, 1,000")).toEqual([["Coins", 1000]])
      expect(read("Coins, 1,000, Abyssal whip")).toEqual([
        ["Coins", 1000],
        ["Abyssal whip", 1],
      ])
    })

    it("ignores empty pieces", () => {
      expect(read("Abyssal whip,, ,Dragon bones,")).toEqual([
        ["Abyssal whip", 1],
        ["Dragon bones", 1],
      ])
    })

    it("drops a line that is only numbers", () => {
      expect(parseItemList("3\n1,000\n2.5m").entries).toEqual([])
    })
  })

  describe("limits", () => {
    const lines = (count: number) =>
      Array.from({ length: count }, (_, i) => `Item ${i + 1}`).join("\n")

    it("caps the list at the server batch limit and counts the rest as ignored", () => {
      expect(MAX_LIST_ENTRIES).toBe(100)
      const result = parseItemList(lines(105))
      expect(result.entries).toHaveLength(100)
      expect(result.entries.at(-1)?.name).toBe("Item 100")
      expect(result.ignored).toBe(5)
    })

    it("keeps exactly 100 entries without ignoring any", () => {
      const result = parseItemList(lines(100))
      expect(result.entries).toHaveLength(100)
      expect(result.ignored).toBe(0)
    })

    it("counts pieces of a split line towards the cap", () => {
      const result = parseItemList(
        Array.from({ length: 101 }, (_, i) => `Item ${i + 1}`).join(", ")
      )
      expect(result.entries).toHaveLength(100)
      expect(result.ignored).toBe(1)
    })

    it("ignores a name that is too long for the resolver", () => {
      const tooLong = "a".repeat(MAX_ITEM_NAME_LENGTH + 1)
      const result = parseItemList(`${tooLong}\nAbyssal whip`)
      expect(result.entries.map((e) => e.name)).toEqual(["Abyssal whip"])
      expect(result.ignored).toBe(1)

      const fits = parseItemList("a".repeat(MAX_ITEM_NAME_LENGTH))
      expect(fits.entries).toHaveLength(1)
      expect(fits.ignored).toBe(0)
    })
  })
})
