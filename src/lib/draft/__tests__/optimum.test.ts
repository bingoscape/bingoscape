/**
 * @jest-environment node
 *
 * The balance gap to the simulated annealing optimum (team draft 4/4, #218).
 * The annealing draws `Math.random()`; a fixed sequence is installed so the
 * comparison is reproducible.
 */
import {
  compareToOptimum,
  type OptimumPlayerMetadata,
} from "@/lib/draft/optimum"

function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const meta = (ehp: number): OptimumPlayerMetadata => ({
  timezone: "Europe/London",
  ehp,
  ehb: ehp / 2,
  dailyHoursAvailable: 2 + (ehp % 3),
  skillLevel: null,
})

// Eight players, EHP 100 .. 800.
const ids = Array.from({ length: 8 }, (_, i) => `u${i}`)
const metadata = new Map(ids.map((id, i) => [id, meta((i + 1) * 100)]))

beforeEach(() => {
  jest.spyOn(Math, "random").mockImplementation(seededRandom(42))
  jest.spyOn(console, "log").mockImplementation(() => undefined)
})
afterEach(() => jest.restoreAllMocks())

describe("compareToOptimum", () => {
  it("a lopsided draft is far from the optimum, a mirrored one is close", () => {
    const lopsided = compareToOptimum([ids.slice(4), ids.slice(0, 4)], metadata)
    const even = compareToOptimum(
      [
        ["u0", "u3", "u4", "u7"],
        ["u1", "u2", "u5", "u6"],
      ],
      metadata
    )
    expect(lopsided).not.toBeNull()
    expect(even).not.toBeNull()
    expect(lopsided!.players).toBe(8)
    expect(lopsided!.teams).toBe(2)
    expect(lopsided!.gap).toBeGreaterThan(even!.gap!)
    expect(lopsided!.gap).toBeCloseTo(lopsided!.actual! - lopsided!.optimum, 10)
    expect(even!.gap).toBeGreaterThanOrEqual(0)
    expect(even!.gap!).toBeLessThan(0.1)
    expect(lopsided!.optimum).toBeLessThan(lopsided!.actual!)
  })

  it("scores players without metadata like the optimiser does (their stats are the mean)", () => {
    const sparse = new Map<string, OptimumPlayerMetadata>([
      ["u0", meta(100)],
      ["u1", meta(800)],
    ])
    const result = compareToOptimum([ids.slice(0, 4), ids.slice(4)], sparse)
    expect(result).not.toBeNull()
    expect(Number.isFinite(result!.optimum)).toBe(true)
    expect(result!.gap).toBeGreaterThanOrEqual(0)
  })

  it("has no actual score when the team sizes are too uneven", () => {
    const result = compareToOptimum([ids.slice(0, 1), ids.slice(1)], metadata)
    expect(result).not.toBeNull()
    expect(result!.actual).toBeNull()
    expect(result!.gap).toBeNull()
    expect(Number.isFinite(result!.optimum)).toBe(true)
  })

  it("compares nothing with fewer than two teams or no players", () => {
    expect(compareToOptimum([ids], metadata)).toBeNull()
    expect(compareToOptimum([], metadata)).toBeNull()
    expect(compareToOptimum([[], []], metadata)).toBeNull()
  })
})
