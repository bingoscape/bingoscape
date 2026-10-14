/**
 * @jest-environment node
 */
import {
  MAX_QUEUE_LENGTH,
  chooseAutoPick,
  normalizeQueue,
} from "@/lib/draft/autopick"

const candidates = [
  { poolEntryId: "a", rating: 0.4 },
  { poolEntryId: "b", rating: 0.9 },
  { poolEntryId: "c", rating: null },
  { poolEntryId: "d", rating: 0.9 },
]
const never = () => {
  throw new Error("no randomness expected")
}

describe("chooseAutoPick", () => {
  it("takes the best rated candidate, the first one on a tie", () => {
    expect(
      chooseAutoPick({ rule: "best_rated", candidates, randomInt: never })
    ).toEqual({ poolEntryId: "b", source: "rule" })
  })

  it("ranks unrated players last", () => {
    expect(
      chooseAutoPick({
        rule: "best_rated",
        candidates: [
          { poolEntryId: "x", rating: null },
          { poolEntryId: "y", rating: 0 },
        ],
        randomInt: never,
      })
    ).toEqual({ poolEntryId: "y", source: "rule" })
  })

  it("falls back to the first candidate when nobody is rated", () => {
    expect(
      chooseAutoPick({
        rule: "best_rated",
        candidates: [
          { poolEntryId: "x", rating: null },
          { poolEntryId: "y", rating: null },
        ],
        randomInt: never,
      })
    ).toEqual({ poolEntryId: "x", source: "rule" })
  })

  it("draws a random candidate with the random rule", () => {
    const picked = chooseAutoPick({
      rule: "random",
      candidates,
      randomInt: (bound) => {
        expect(bound).toBe(4)
        return 2
      },
    })
    expect(picked).toEqual({ poolEntryId: "c", source: "rule" })
  })

  it("keeps a random draw inside the candidates", () => {
    expect(
      chooseAutoPick({ rule: "random", candidates, randomInt: () => 99 })
    ).toEqual({ poolEntryId: "d", source: "rule" })
  })

  it("prefers the first queue entry that is still a candidate, whatever the rule", () => {
    expect(
      chooseAutoPick({
        rule: "best_rated",
        candidates,
        queue: ["gone", "c", "a"],
        randomInt: never,
      })
    ).toEqual({ poolEntryId: "c", source: "queue" })
    expect(
      chooseAutoPick({
        rule: "random",
        candidates,
        queue: ["a"],
        randomInt: never,
      })
    ).toEqual({ poolEntryId: "a", source: "queue" })
  })

  it("applies the rule when no queue entry is left", () => {
    expect(
      chooseAutoPick({
        rule: "best_rated",
        candidates,
        queue: ["gone", "also gone"],
        randomInt: never,
      })
    ).toEqual({ poolEntryId: "b", source: "rule" })
  })

  it("returns null without candidates", () => {
    expect(
      chooseAutoPick({
        rule: "best_rated",
        candidates: [],
        queue: ["a"],
        randomInt: never,
      })
    ).toBeNull()
  })
})

describe("normalizeQueue", () => {
  const allowed = new Set(["a", "b", "c"])

  it("keeps the order and drops duplicates and ids that are not allowed", () => {
    expect(normalizeQueue(["c", "x", "a", "c", "b", "a"], allowed)).toEqual([
      "c",
      "a",
      "b",
    ])
  })

  it("caps the length", () => {
    const many = Array.from(
      { length: MAX_QUEUE_LENGTH + 10 },
      (_, i) => `p${i}`
    )
    expect(normalizeQueue(many, new Set(many))).toHaveLength(MAX_QUEUE_LENGTH)
  })

  it("accepts an empty queue", () => {
    expect(normalizeQueue([], allowed)).toEqual([])
  })
})
