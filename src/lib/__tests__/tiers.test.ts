/**
 * @jest-environment node
 */
import {
  DEFAULT_TIER_XP_REQUIREMENT,
  getEffectiveTierXpRequired,
  getTierCapacity,
  getTierEarnedXp,
  getTierStatus,
  getTileTierLock,
  getUnlockedTiers,
  groupTilesByTier,
  type BoardTierData,
} from "@/lib/tiers"

const tile = (
  id: string,
  tier: number,
  weight: number,
  index: number,
  completedBy: string[] = []
) => ({
  id,
  tier,
  weight,
  index,
  teamTileSubmissions: completedBy.map((teamId) => ({
    teamId,
    status: "completed",
  })),
})

const tiles = [
  tile("a", 0, 2, 0, ["t1"]),
  tile("b", 0, 1, 1, ["t1"]),
  tile("c", 0, 5, 2),
  tile("d", 1, 3, 3),
  tile("e", 1, 3, 4),
  tile("f", 2, 4, 5),
]

describe("getUnlockedTiers", () => {
  it("always unlocks tier 0", () => {
    expect([...getUnlockedTiers([])]).toEqual([0])
  })
  it("adds unlocked tiers from progress rows", () => {
    const set = getUnlockedTiers([
      { tier: 0, isUnlocked: true },
      { tier: 1, isUnlocked: true },
      { tier: 2, isUnlocked: false },
    ])
    expect([...set].sort()).toEqual([0, 1])
  })
})

describe("getTierEarnedXp", () => {
  it("sums the weight of the team's completed tiles in a tier", () => {
    expect(getTierEarnedXp(tiles, "t1", 0)).toBe(3)
    expect(getTierEarnedXp(tiles, "t2", 0)).toBe(0)
    expect(getTierEarnedXp(tiles, undefined, 0)).toBe(0)
    expect(getTierEarnedXp(tiles, "t1", 1)).toBe(0)
  })
})

describe("getTierCapacity / getEffectiveTierXpRequired", () => {
  it("sums the weight of every tile in the tier", () => {
    expect(getTierCapacity(tiles, 0)).toBe(8)
    expect(getTierCapacity(tiles, 1)).toBe(6)
    expect(getTierCapacity(tiles, 9)).toBe(0)
  })

  it("keeps a requirement the tier can reach", () => {
    expect(
      getEffectiveTierXpRequired([{ tier: 1, xpRequired: 4 }], tiles, 1)
    ).toBe(4)
  })

  it("caps a requirement above what the tier can yield", () => {
    expect(
      getEffectiveTierXpRequired([{ tier: 1, xpRequired: 20 }], tiles, 1)
    ).toBe(6)
    // The default of 5 on a tier worth 3
    expect(getEffectiveTierXpRequired([], [tile("x", 0, 3, 0)], 0)).toBe(3)
  })

  it("needs nothing from a tier without tiles", () => {
    expect(getEffectiveTierXpRequired([], tiles, 9)).toBe(0)
  })

  it("lets getTierStatus unlock-report against the capped requirement", () => {
    const small = [tile("x", 0, 1, 0, ["t1"]), tile("y", 0, 1, 1, ["t1"])]
    const data: BoardTierData = {
      requirements: [{ tier: 0, xpRequired: 5 }],
      progress: [],
    }
    expect(getTierStatus(1, small, "t1", data)).toMatchObject({
      requiredInPrevious: 2,
      xpNeeded: 0,
    })
  })
})

describe("groupTilesByTier", () => {
  it("groups ascending by tier and orders tiles by index (uneven tiers)", () => {
    const bands = groupTilesByTier([tiles[5]!, tiles[3]!, tiles[1]!, tiles[0]!, tiles[4]!, tiles[2]!])
    expect(bands.map((b) => [b.tier, b.tiles.map((t) => t.id)])).toEqual([
      [0, ["a", "b", "c"]],
      [1, ["d", "e"]],
      [2, ["f"]],
    ])
  })
})

describe("getTierStatus / getTileTierLock", () => {
  const data: BoardTierData = {
    requirements: [
      { tier: 0, xpRequired: 5 },
      { tier: 1, xpRequired: 4 },
    ],
    progress: [{ tier: 0, isUnlocked: true }],
  }

  it("tier 0 is never locked", () => {
    expect(getTileTierLock(tiles[0]!, tiles, "t1", data)).toBeNull()
  })

  it("a locked tier reports the XP still needed in the previous tier", () => {
    expect(getTierStatus(1, tiles, "t1", data)).toEqual({
      tier: 1,
      unlocked: false,
      earnedInPrevious: 3,
      requiredInPrevious: 5,
      xpNeeded: 2,
    })
    expect(getTileTierLock(tiles[3]!, tiles, "t1", data)).toEqual({
      tier: 1,
      xpNeeded: 2,
    })
  })

  it("an unlocked tier has nothing missing", () => {
    const unlocked: BoardTierData = {
      ...data,
      progress: [
        { tier: 0, isUnlocked: true },
        { tier: 1, isUnlocked: true },
      ],
    }
    expect(getTileTierLock(tiles[3]!, tiles, "t1", unlocked)).toBeNull()
  })

  it("falls back to the default requirement", () => {
    const noReqs: BoardTierData = { requirements: [], progress: [] }
    expect(getTierStatus(1, tiles, "t2", noReqs).requiredInPrevious).toBe(
      DEFAULT_TIER_XP_REQUIREMENT
    )
  })

  it("never needs a negative amount", () => {
    const rich = [tile("x", 0, 50, 0, ["t1"]), tile("y", 1, 1, 1)]
    expect(
      getTierStatus(1, rich, "t1", { requirements: [], progress: [] }).xpNeeded
    ).toBe(0)
  })

  it("measures against the closest tier below when the board skips a number", () => {
    // Tier 0 (a, b, c) and Tier 2 (d, e); there is no Tier 1.
    const gap = [
      tile("a", 0, 2, 0, ["t1"]),
      tile("b", 0, 3, 1),
      tile("d", 2, 3, 2),
    ]
    const withGap: BoardTierData = {
      requirements: [{ tier: 0, xpRequired: 4 }],
      progress: [],
    }
    expect(getTierStatus(2, gap, "t1", withGap)).toEqual({
      tier: 2,
      unlocked: false,
      earnedInPrevious: 2,
      requiredInPrevious: 4,
      xpNeeded: 2,
    })
  })

  it("no tier data (standard board) means no lock", () => {
    expect(getTileTierLock(tiles[5]!, tiles, "t1", null)).toBeNull()
  })
})
