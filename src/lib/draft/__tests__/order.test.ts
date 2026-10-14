/**
 * @jest-environment node
 */
import {
  identityPermutation,
  isPermutation,
  pickSchedule,
  roundOf,
  seededPermutation,
  slotFor,
  totalPicks,
} from "@/lib/draft/order"

const CAPTAIN_COUNTS = [2, 3, 4, 5, 6, 7, 8]

describe("slotFor", () => {
  describe.each(CAPTAIN_COUNTS)("%s captains", (n) => {
    const rounds = 4
    const forward = identityPermutation(n)
    const backward = [...forward].reverse()

    it("linear repeats the same order every round", () => {
      for (let round = 1; round <= rounds; round++) {
        const positions = forward.map((_, i) =>
          slotFor((round - 1) * n + i + 1, n, "linear")
        )
        expect(positions).toEqual(forward)
      }
    })

    it("snake reverses on even rounds", () => {
      for (let round = 1; round <= rounds; round++) {
        const positions = forward.map((_, i) =>
          slotFor((round - 1) * n + i + 1, n, "snake")
        )
        expect(positions).toEqual(round % 2 === 1 ? forward : backward)
      }
    })

    it("snake gives the last captain of a round the first pick of the next", () => {
      expect(slotFor(n, n, "snake")).toBe(n - 1)
      expect(slotFor(n + 1, n, "snake")).toBe(n - 1)
    })

    it("gives every captain the same number of picks over whole rounds", () => {
      for (const orderType of ["linear", "snake"] as const) {
        const counts = new Array<number>(n).fill(0)
        for (const { position } of pickSchedule(rounds, n, orderType)) {
          counts[position] = (counts[position] ?? 0) + 1
        }
        expect(counts).toEqual(new Array<number>(n).fill(rounds))
      }
    })
  })

  it("random_snake is a snake over the permutation", () => {
    const permutation = [2, 0, 3, 1]
    const round1 = [1, 2, 3, 4].map((p) =>
      slotFor(p, 4, "random_snake", permutation)
    )
    const round2 = [5, 6, 7, 8].map((p) =>
      slotFor(p, 4, "random_snake", permutation)
    )
    expect(round1).toEqual([2, 0, 3, 1])
    expect(round2).toEqual([1, 3, 0, 2])
  })

  it("applies a permutation to linear and snake too, defaulting to the identity", () => {
    expect(slotFor(1, 3, "linear", [2, 1, 0])).toBe(2)
    expect(slotFor(4, 3, "snake", [2, 1, 0])).toBe(0)
    expect(slotFor(4, 3, "snake")).toBe(2)
  })

  it("requires a permutation for random_snake and rejects a wrong one", () => {
    expect(() => slotFor(1, 3, "random_snake")).toThrow(/permutation/)
    expect(() => slotFor(1, 3, "snake", [0, 1])).toThrow()
    expect(() => slotFor(1, 3, "snake", [0, 0, 1])).toThrow()
  })

  it("rejects impossible input", () => {
    expect(() => slotFor(0, 3, "snake")).toThrow(RangeError)
    expect(() => slotFor(1.5, 3, "snake")).toThrow(RangeError)
    expect(() => slotFor(1, 0, "snake")).toThrow(RangeError)
  })
})

describe("roundOf / totalPicks", () => {
  it("numbers rounds from 1", () => {
    expect([1, 4, 5, 8, 9].map((p) => roundOf(p, 4))).toEqual([1, 1, 2, 2, 3])
    expect(totalPicks(6, 4)).toBe(24)
  })
})

describe("seededPermutation", () => {
  it("is reproducible for a seed", () => {
    expect(seededPermutation(42, 8)).toEqual(seededPermutation(42, 8))
  })

  it("returns a permutation of 0..n-1", () => {
    for (const n of CAPTAIN_COUNTS) {
      for (const seed of [0, 1, 7, 123456, 4294967295]) {
        expect(isPermutation(seededPermutation(seed, n), n)).toBe(true)
      }
    }
  })

  it("differs between seeds", () => {
    const orders = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        seededPermutation(seed, 8).join(",")
      )
    )
    expect(orders.size).toBeGreaterThan(10)
  })
})

describe("isPermutation", () => {
  it("accepts only each of 0..n-1 exactly once", () => {
    expect(isPermutation([1, 0, 2], 3)).toBe(true)
    expect(isPermutation([1, 1, 2], 3)).toBe(false)
    expect(isPermutation([0, 1], 3)).toBe(false)
    expect(isPermutation([0, 1, 3], 3)).toBe(false)
    expect(isPermutation("012", 3)).toBe(false)
    expect(isPermutation([0, 1.5, 2], 3)).toBe(false)
  })
})
