/**
 * @jest-environment node
 */
import { getAllItems } from "osrs-item-data"
import { resolveOsrsItemNames } from "@/app/actions/osrs-items"
import { logger } from "@/lib/logger"
import type { OsrsItem } from "@/types/osrs-items"

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))
jest.mock("osrs-item-data", () => ({
  getAllItems: jest.fn(),
  getItemById: jest.fn(),
  getItemsById: jest.fn(),
  getItemByName: jest.fn(),
  getItemVariants: jest.fn(),
  parseItemName: jest.fn(),
  getItemImageUrl: jest.fn(),
}))

const mockedGetAllItems = getAllItems as jest.Mock
const mockedLogger = logger.error as jest.Mock

let nextId = 1
function item(name: string): OsrsItem {
  const [baseName = name, variant] = name.split("#")
  return {
    id: nextId++,
    name,
    baseName,
    ...(variant ? { variant } : {}),
    imageUrl: `/${nextId}.png`,
  }
}

const WHIP = item("Abyssal whip")
const BONES = item("Dragon bones")
const GLORY = ["1", "2", "3", "4", "5", "6", "Uncharged"].map((v) =>
  item(`Amulet of glory#${v}`)
)
const TENTACLE = item("Abyssal tentacle")
const KRAKEN_TENTACLE = item("Kraken tentacle")

beforeAll(() => {
  mockedGetAllItems.mockReturnValue([
    WHIP,
    BONES,
    ...GLORY,
    TENTACLE,
    KRAKEN_TENTACLE,
  ])
})

beforeEach(() => {
  mockedLogger.mockClear()
})

const entry = (name: string, quantity = 1) => ({ name, quantity })

describe("resolveOsrsItemNames", () => {
  describe("matching", () => {
    it("answers every entry in order, with its quantity", async () => {
      const result = await resolveOsrsItemNames([
        entry("abyssal whip", 2),
        entry("Amulet of glory", 1),
        entry("Nonexistent thing", 5),
        entry("Dragon bones", 100),
      ])

      expect(result.success).toBe(true)
      expect(result.results).toEqual([
        {
          input: "abyssal whip",
          quantity: 2,
          status: "matched",
          item: WHIP,
        },
        {
          input: "Amulet of glory",
          quantity: 1,
          status: "ambiguous",
          candidates: GLORY.slice(0, 5),
        },
        { input: "Nonexistent thing", quantity: 5, status: "unmatched" },
        {
          input: "Dragon bones",
          quantity: 100,
          status: "matched",
          item: BONES,
        },
      ])
    })

    it("reports ambiguous results for equally good ranking hits", async () => {
      const { results } = await resolveOsrsItemNames([entry("tentacle")])
      expect(results[0]?.status).toBe("ambiguous")
      expect(results[0]?.candidates).toHaveLength(2)
    })

    it("resolves the more certain reading of an entry with alternatives", async () => {
      const { results } = await resolveOsrsItemNames([
        {
          name: "Amulet of glory",
          quantity: 4,
          alternatives: [{ name: "Amulet of glory(4)", quantity: 1 }],
        },
      ])
      expect(results[0]).toEqual({
        input: "Amulet of glory(4)",
        quantity: 1,
        status: "matched",
        item: GLORY[3],
      })
    })

    it("trims the names", async () => {
      const { results } = await resolveOsrsItemNames([entry("  Abyssal whip ")])
      expect(results[0]).toMatchObject({
        input: "Abyssal whip",
        status: "matched",
      })
    })

    it("accepts an empty list", async () => {
      expect(await resolveOsrsItemNames([])).toEqual({
        success: true,
        results: [],
      })
    })

    it("accepts exactly 100 entries", async () => {
      const result = await resolveOsrsItemNames(
        Array.from({ length: 100 }, () => entry("Abyssal whip"))
      )
      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(100)
    })

    it("builds the item index once and reuses it", async () => {
      await resolveOsrsItemNames([entry("Abyssal whip")])
      await resolveOsrsItemNames([entry("Dragon bones")])
      expect(mockedGetAllItems).toHaveBeenCalledTimes(1)
    })
  })

  describe("validation", () => {
    const rejects = async (entries: unknown, message: RegExp) => {
      const result = await resolveOsrsItemNames(
        entries as Parameters<typeof resolveOsrsItemNames>[0]
      )
      expect(result.success).toBe(false)
      expect(result.results).toEqual([])
      expect(result.error).toMatch(message)
    }

    it("rejects more than 100 entries", async () => {
      await rejects(
        Array.from({ length: 101 }, () => entry("Abyssal whip")),
        /at most 100 items/
      )
    })

    it("rejects something that is not a list", async () => {
      await rejects("Abyssal whip", /invalid item list/i)
      await rejects(null, /invalid item list/i)
      await rejects({ name: "Abyssal whip", quantity: 1 }, /invalid item list/i)
    })

    it("rejects empty and whitespace-only names", async () => {
      await rejects([entry("")], /cannot be empty/)
      await rejects([entry("   ")], /cannot be empty/)
    })

    it("rejects entries that are not objects with a string name", async () => {
      await rejects([null], /cannot be empty/)
      await rejects([{ name: 42, quantity: 1 }], /cannot be empty/)
    })

    it("rejects names longer than 100 characters, after trimming", async () => {
      await rejects([entry("a".repeat(101))], /at most 100 characters/)

      const ok = await resolveOsrsItemNames([entry(`  ${"a".repeat(100)}  `)])
      expect(ok.success).toBe(true)
      expect(ok.results[0]?.status).toBe("unmatched")
    })

    it.each([[0], [-1], [1.5], [2_147_483_648], ["3"], [NaN]])(
      "rejects the quantity %p",
      async (quantity) => {
        await rejects([{ name: "Abyssal whip", quantity }], /quantity/i)
      }
    )

    it("validates the alternatives like the entry itself", async () => {
      await rejects(
        [{ name: "Abyssal whip", quantity: 1, alternatives: [entry("")] }],
        /cannot be empty/
      )
      await rejects(
        [
          {
            name: "Abyssal whip",
            quantity: 1,
            alternatives: [{ name: "Abyssal whip", quantity: 0 }],
          },
        ],
        /quantity/i
      )
    })

    it("rejects more than three alternatives", async () => {
      await rejects(
        [
          {
            name: "Abyssal whip",
            quantity: 1,
            alternatives: Array.from({ length: 4 }, () =>
              entry("Dragon bones")
            ),
          },
        ],
        /invalid item list/i
      )
    })

    it("does not look anything up for a rejected request", async () => {
      mockedGetAllItems.mockClear()
      await resolveOsrsItemNames([entry("")])
      expect(mockedGetAllItems).not.toHaveBeenCalled()
    })
  })

  describe("when the item data cannot be read", () => {
    it("returns a friendly error and logs it", async () => {
      jest.resetModules()
      const error = jest.fn()
      jest.doMock("@/lib/logger", () => ({ logger: { error } }))
      jest.doMock("osrs-item-data", () => ({
        getAllItems: () => {
          throw new Error("boom")
        },
      }))

      const { resolveOsrsItemNames: resolveWithBrokenData } =
        await import("@/app/actions/osrs-items")
      const result = await resolveWithBrokenData([entry("Abyssal whip")])

      expect(result).toEqual({
        success: false,
        results: [],
        error: "Failed to match the items",
      })
      expect(error).toHaveBeenCalled()
      jest.dontMock("@/lib/logger")
      jest.dontMock("osrs-item-data")
    })
  })
})
