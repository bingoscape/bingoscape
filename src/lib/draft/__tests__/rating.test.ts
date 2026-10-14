/**
 * @jest-environment node
 */
import { DRAFT_RATING_SOURCE, rateDraftPool } from "@/lib/draft/rating"

const meta = (
  ehp: number | null,
  ehb: number | null,
  dailyHoursAvailable: number | null
) => ({ ehp, ehb, dailyHoursAvailable })

describe("rateDraftPool", () => {
  it("records which formula rated the pool", () => {
    expect(DRAFT_RATING_SOURCE).toBe("team_balancing_v1")
  })

  it("rates 0..1 and ranks a stronger player higher", () => {
    const [weak, mid, strong] = rateDraftPool([
      { userId: "weak", metadata: meta(100, 5, 1) },
      { userId: "mid", metadata: meta(500, 50, 3) },
      { userId: "strong", metadata: meta(2000, 400, 8) },
    ])
    for (const r of [weak, mid, strong]) {
      expect(r!.rating).toBeGreaterThan(0)
      expect(r!.rating).toBeLessThanOrEqual(1)
    }
    expect(strong!.rating!).toBeGreaterThan(mid!.rating!)
    expect(mid!.rating!).toBeGreaterThan(weak!.rating!)
    expect(strong!.rating).toBeCloseTo(1)
  })

  it("returns the ratings in the order of the input", () => {
    const ratings = rateDraftPool([
      { userId: "b", metadata: meta(1, 1, 1) },
      { userId: "a", metadata: meta(2, 2, 2) },
    ])
    expect(ratings.map((r) => r.userId)).toEqual(["b", "a"])
  })

  it("leaves a player without data unrated, and unrated players do not shift others", () => {
    const withUnrated = rateDraftPool([
      { userId: "a", metadata: meta(100, 10, 2) },
      { userId: "b", metadata: meta(900, 90, 6) },
      { userId: "none", metadata: null },
      { userId: "empty", metadata: meta(null, null, 4) },
    ])
    const without = rateDraftPool([
      { userId: "a", metadata: meta(100, 10, 2) },
      { userId: "b", metadata: meta(900, 90, 6) },
    ])
    const of = (list: typeof withUnrated, id: string) =>
      list.find((r) => r.userId === id)!.rating
    expect(of(withUnrated, "none")).toBeNull()
    expect(of(withUnrated, "empty")).toBeNull()
    expect(of(withUnrated, "a")).toBeCloseTo(of(without, "a")!)
    expect(of(withUnrated, "b")).toBeCloseTo(of(without, "b")!)
  })

  it("imputes missing values with the pool mean", () => {
    // `c` lacks EHB and hours; it is rated as if it had the mean of the others.
    const [, , c] = rateDraftPool([
      { userId: "a", metadata: meta(100, 10, 2) },
      { userId: "b", metadata: meta(300, 30, 4) },
      { userId: "c", metadata: meta(200, null, null) },
    ])
    const explicit = rateDraftPool([
      { userId: "a", metadata: meta(100, 10, 2) },
      { userId: "b", metadata: meta(300, 30, 4) },
      { userId: "c", metadata: meta(200, 20, 3) },
    ])
    expect(c!.rating).toBeCloseTo(explicit[2]!.rating!)
  })

  it("handles an empty pool and a pool of one", () => {
    expect(rateDraftPool([])).toEqual([])
    expect(
      rateDraftPool([{ userId: "solo", metadata: meta(10, 1, 1) }])[0]!.rating
    ).toBe(1)
  })
})
