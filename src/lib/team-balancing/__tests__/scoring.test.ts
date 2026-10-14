/**
 * @jest-environment node
 */
import {
  DISPLAY_BALANCING_WEIGHTS,
  calculateMean,
  calculatePlayerScore,
  percentileNormalize,
  preparePlayerFeatures,
  timezoneOffsetToAngle,
} from "@/lib/team-balancing/scoring"

describe("percentileNormalize", () => {
  it("ranks a value within the population", () => {
    expect(percentileNormalize(30, [10, 20, 30, 40])).toBe(0.75)
    expect(percentileNormalize(10, [10, 20, 30, 40])).toBe(0.25)
    expect(percentileNormalize(40, [10, 20, 30, 40])).toBe(1)
  })

  it("is neutral for missing data", () => {
    expect(percentileNormalize(null, [1, 2, 3])).toBe(0.5)
    expect(percentileNormalize(undefined, [1, 2, 3])).toBe(0.5)
    expect(percentileNormalize(5, [null, undefined])).toBe(0.5)
  })

  it("ignores missing values of the population", () => {
    expect(percentileNormalize(2, [null, 1, 2, undefined])).toBe(1)
  })
})

describe("calculateMean", () => {
  it("averages the present values", () => {
    expect(calculateMean([1, 2, 3, null, undefined])).toBe(2)
    expect(calculateMean([])).toBe(0)
    expect(calculateMean([null])).toBe(0)
  })
})

describe("calculatePlayerScore", () => {
  const players = [
    { ehp: 100, ehb: 10, timezone: null, dailyHoursAvailable: 1 },
    { ehp: 200, ehb: 20, timezone: null, dailyHoursAvailable: 2 },
    { ehp: 300, ehb: 30, timezone: null, dailyHoursAvailable: 3 },
  ]

  it("weights the percentiles and normalises by the weight sum", () => {
    const { score, breakdown } = calculatePlayerScore(
      players[0]!,
      players,
      DISPLAY_BALANCING_WEIGHTS
    )
    expect(breakdown.ehp).toBeCloseTo((1 / 3) * 0.33)
    expect(breakdown.ehb).toBeCloseTo((1 / 3) * 0.33)
    expect(breakdown.dailyHours).toBeCloseTo((1 / 3) * 0.34)
    expect(score).toBeCloseTo(1 / 3)
  })

  it("scores the best player 1 and falls back to 0.5 without weights", () => {
    expect(
      calculatePlayerScore(players[2]!, players, DISPLAY_BALANCING_WEIGHTS)
        .score
    ).toBeCloseTo(1)
    expect(
      calculatePlayerScore(players[2]!, players, {
        ehp: 0,
        ehb: 0,
        dailyHours: 0,
      }).score
    ).toBe(0.5)
  })
})

describe("preparePlayerFeatures", () => {
  it("imputes missing values with the mean and maps skill levels", () => {
    const metadata = new Map([
      [
        "a",
        {
          timezone: "UTC",
          ehp: 100,
          ehb: 10,
          dailyHoursAvailable: 2,
          skillLevel: "beginner",
        },
      ],
      [
        "b",
        {
          timezone: null,
          ehp: 300,
          ehb: null,
          dailyHoursAvailable: null,
          skillLevel: "advanced",
        },
      ],
    ])
    const [a, b, c] = preparePlayerFeatures(
      [{ userId: "a" }, { userId: "b" }, { userId: "c" }],
      metadata
    )
    expect(a).toMatchObject({ ehp: 100, ehb: 10, dailyHours: 2, skillLevel: 1 })
    expect(b).toMatchObject({ ehp: 300, ehb: 10, dailyHours: 2, skillLevel: 3 })
    // A player without metadata gets the means (skill: mean of 1 and 3).
    expect(c).toMatchObject({ ehp: 200, ehb: 10, dailyHours: 2, skillLevel: 2 })
    expect(c!.timezoneAngle).toBe(0)
  })
})

describe("timezoneOffsetToAngle", () => {
  it("maps 24 hours onto a full turn", () => {
    expect(timezoneOffsetToAngle(0)).toBe(0)
    expect(timezoneOffsetToAngle(6)).toBeCloseTo(Math.PI / 2)
    expect(timezoneOffsetToAngle(-12)).toBeCloseTo(-Math.PI)
  })
})
