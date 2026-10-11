/**
 * @jest-environment node
 */
import { db } from "@/server/db"
import { getTemplateDetail } from "@/server/queries/templates"

jest.mock("@/lib/getRandomFrog", () => ({
  __esModule: true,
  default: jest.fn(() => "frog.png"),
}))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))
jest.mock("@/server/db", () => ({
  db: { query: { bingoTemplates: { findFirst: jest.fn() } } },
}))

const findFirst = (
  db as unknown as { query: { bingoTemplates: { findFirst: jest.Mock } } }
).query.bingoTemplates.findFirst

const templateData = JSON.stringify({
  version: "2.0",
  metadata: { title: "T", rows: 1, columns: 2, bingoType: "standard" },
  tiles: [
    {
      title: "Open",
      description: "",
      weight: 1,
      index: 0,
      isHidden: false,
      tier: 0,
    },
    {
      title: "Secret",
      description: "Spoiler",
      weight: 9,
      index: 1,
      isHidden: true,
      tier: 0,
    },
  ],
})

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    title: "Template",
    description: "d",
    category: "PvM",
    tags: "a, b",
    isPublic: false,
    creatorId: "owner",
    downloadCount: 3,
    createdAt: new Date("2026-01-01"),
    templateData,
    creator: { id: "owner", name: "Zezima", image: null },
    schemaVersion: null,
    bingoType: null,
    rows: null,
    columns: null,
    tileCount: null,
    tierCount: null,
    totalXp: null,
    hasPatternBonuses: null,
    hasHiddenTiles: null,
    ...overrides,
  }
}

beforeEach(() => jest.clearAllMocks())

describe("getTemplateDetail", () => {
  it("hides private templates from other users", async () => {
    findFirst.mockResolvedValue(row())

    await expect(getTemplateDetail("t1", "intruder")).resolves.toBeNull()
  })

  it("returns null for unknown templates", async () => {
    findFirst.mockResolvedValue(undefined)

    await expect(getTemplateDetail("nope", "owner")).resolves.toBeNull()
  })

  it("shows private templates to their creator, flagged as owner", async () => {
    findFirst.mockResolvedValue(row())

    const detail = await getTemplateDetail("t1", "owner")

    expect(detail).toMatchObject({
      id: "t1",
      isOwner: true,
      tags: ["a", "b"],
      creatorName: "Zezima",
    })
    expect(detail?.preview?.maskedCount).toBe(0)
  })

  it("masks hidden tiles for other viewers of a public template", async () => {
    findFirst.mockResolvedValue(row({ isPublic: true }))

    const detail = await getTemplateDetail("t1", "someone")

    expect(detail?.isOwner).toBe(false)
    expect(detail?.preview?.maskedCount).toBe(1)
    expect(JSON.stringify(detail)).not.toContain("Secret")
    expect(JSON.stringify(detail)).not.toContain("Spoiler")
  })

  it("computes facts from the document when the columns are not backfilled", async () => {
    findFirst.mockResolvedValue(row({ isPublic: true }))

    const detail = await getTemplateDetail("t1", "someone")

    expect(detail?.facts).toMatchObject({
      rows: 1,
      columns: 2,
      tileCount: 2,
      totalXp: 10,
      hasHiddenTiles: true,
    })
  })

  it("survives unreadable stored data", async () => {
    findFirst.mockResolvedValue(row({ isPublic: true, templateData: "{nope" }))

    const detail = await getTemplateDetail("t1", "someone")

    expect(detail).toMatchObject({ preview: null, facts: null })
  })
})
