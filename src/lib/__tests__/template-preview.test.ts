/**
 * @jest-environment node
 */
import { parseExportedBingo } from "@/lib/bingo-template-schema"
import getTemplateBoard from "@/lib/getTemplateBoard"
import {
  buildCardPreview,
  buildDetailPreview,
  MASKED_TILE_TITLE,
  safePreviewImage,
} from "@/lib/template-preview"

function exported(raw: Record<string, unknown>) {
  const parsed = parseExportedBingo(raw)
  if (!parsed.success) throw new Error(parsed.error)
  return parsed.data
}

const board = exported({
  version: "2.0",
  metadata: {
    title: "T",
    rows: 2,
    columns: 2,
    bingoType: "progression",
    tiersUnlockRequirement: 9,
  },
  tiles: [
    {
      title: "Secret boss",
      description: "Kill it",
      weight: 50,
      index: 1,
      isHidden: true,
      tier: 1,
      headerImage: "https://oldschool.runescape.wiki/images/a.png",
      goals: [{ description: "Kills", targetValue: 3 }],
    },
    {
      title: "Warm up",
      description: "Easy",
      weight: 5,
      index: 0,
      isHidden: false,
      tier: 0,
      headerImage: "https://evil.example.com/pixel.png",
      goals: [],
    },
  ],
  tierXpRequirements: [{ tier: 0, xpRequired: 4 }],
})

describe("safePreviewImage", () => {
  it("allows own uploads and configured hosts only", () => {
    expect(safePreviewImage("/uploads/a.png")).toBe("/uploads/a.png")
    expect(safePreviewImage("https://oldschool.runescape.wiki/x.png")).toBe(
      "https://oldschool.runescape.wiki/x.png"
    )
    expect(safePreviewImage("https://evil.example.com/x.png")).toBeNull()
    expect(safePreviewImage("http://oldschool.runescape.wiki/x.png")).toBeNull()
    expect(safePreviewImage("//evil.example.com/x.png")).toBeNull()
    expect(safePreviewImage("javascript:alert(1)")).toBeNull()
    expect(safePreviewImage(null)).toBeNull()
  })
})

describe("buildDetailPreview", () => {
  it("masks hidden tiles for non-owners", () => {
    const preview = buildDetailPreview(board, { isOwner: false })
    const secret = preview.tiles.find((t) => t.index === 1)

    expect(secret).toMatchObject({
      title: MASKED_TILE_TITLE,
      headerImage: null,
      weight: null,
      description: "",
      goals: [],
      masked: true,
      isHidden: true,
    })
    expect(preview.maskedCount).toBe(1)
    expect(JSON.stringify(preview)).not.toContain("Secret boss")
    expect(JSON.stringify(preview)).not.toContain("Kill it")
  })

  it("shows hidden tiles to the owner but still flags them", () => {
    const preview = buildDetailPreview(board, { isOwner: true })
    const secret = preview.tiles.find((t) => t.index === 1)

    expect(secret).toMatchObject({
      title: "Secret boss",
      weight: 50,
      masked: false,
      isHidden: true,
    })
    expect(secret?.goals).toEqual([{ description: "Kills", targetValue: 3 }])
    expect(preview.maskedCount).toBe(0)
  })

  it("orders tiles by index and drops disallowed image hosts", () => {
    const preview = buildDetailPreview(board, { isOwner: true })

    expect(preview.tiles.map((t) => t.index)).toEqual([0, 1])
    expect(preview.tiles[0]?.headerImage).toBeNull()
  })

  it("builds the tier ladder for progression boards", () => {
    const preview = buildDetailPreview(board, { isOwner: false })

    expect(preview.tiers).toEqual([
      { tier: 0, tileCount: 1, totalXp: 5, maskedCount: 0, unlockXp: 4 },
      // Masked tiles contribute no XP; the last tier unlocks nothing.
      { tier: 1, tileCount: 1, totalXp: 0, maskedCount: 1, unlockXp: null },
    ])
  })

  it("falls back to the board unlock requirement for missing tier rows", () => {
    const preview = buildDetailPreview(
      exported({
        version: "2.0",
        metadata: {
          title: "T",
          rows: 1,
          columns: 2,
          bingoType: "progression",
          tiersUnlockRequirement: 9,
        },
        tiles: [
          { title: "a", description: "", weight: 1, index: 0, tier: 0 },
          { title: "b", description: "", weight: 1, index: 1, tier: 1 },
        ],
      }),
      { isOwner: true }
    )

    expect(preview.tiers[0]?.unlockXp).toBe(9)
  })

  it("exposes pattern bonuses only when there are some", () => {
    expect(buildDetailPreview(board, { isOwner: true }).bonuses).toBeNull()

    const withBonuses = buildDetailPreview(
      exported({
        version: "2.0",
        metadata: {
          title: "T",
          rows: 2,
          columns: 2,
          bingoType: "standard",
          completeBoardBonusXP: 20,
        },
        tiles: [],
        rowBonuses: [
          { rowIndex: 1, bonusXP: 3 },
          { rowIndex: 0, bonusXP: 0 },
        ],
      }),
      { isOwner: false }
    )

    expect(withBonuses.bonuses).toEqual({
      rows: [{ index: 1, xp: 3 }],
      columns: [],
      mainDiagonal: 0,
      antiDiagonal: 0,
      completeBoard: 20,
    })
  })
})

describe("landing sample board", () => {
  it("parses and previews without masking", () => {
    const parsed = parseExportedBingo(getTemplateBoard())
    if (!parsed.success) throw new Error(parsed.error)

    const preview = buildDetailPreview(parsed.data, { isOwner: true })

    expect(preview.tiles).toHaveLength(9)
    expect(preview.maskedCount).toBe(0)
  })
})

describe("buildCardPreview", () => {
  it("never carries titles, descriptions or hidden images", () => {
    const preview = buildCardPreview(board)
    const json = JSON.stringify(preview)

    expect(json).not.toContain("Secret boss")
    expect(json).not.toContain("Warm up")
    expect(preview.cells.find((c) => c.index === 1)).toEqual({
      index: 1,
      headerImage: null,
      tier: 1,
      masked: true,
    })
  })
})
