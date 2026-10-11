/**
 * @jest-environment node
 */
import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
import {
  deleteTemplate,
  importTemplateIntoEvent,
  saveBingoAsTemplate,
  updateTemplate,
} from "@/app/actions/templates"
import {
  exportBingoBoard,
  importBingoBoard,
} from "@/app/actions/bingo-import-export"
import { revalidatePath } from "next/cache"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("@/app/actions/bingo-import-export", () => ({
  exportBingoBoard: jest.fn(),
  importBingoBoard: jest.fn(),
}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))
jest.mock("@/server/db", () => ({
  db: {
    query: { bingoTemplates: { findFirst: jest.fn() } },
    transaction: jest.fn(),
    update: jest.fn(),
  },
}))

const session = getServerAuthSession as jest.Mock
const exportBoard = exportBingoBoard as jest.Mock
const importBoard = importBingoBoard as jest.Mock
const revalidate = revalidatePath as jest.Mock
const mockDb = db as unknown as {
  query: { bingoTemplates: { findFirst: jest.Mock } }
  transaction: jest.Mock
  update: jest.Mock
}
const findFirst = mockDb.query.bingoTemplates.findFirst

// Transaction mock: hands the callback a tx whose calls are recorded.
const txInsertValues = jest.fn()
const txUpdateSet = jest.fn()
const txDelete = jest.fn()
const txFindFirst = jest.fn()

const tx = {
  query: { bingoTemplates: { findFirst: txFindFirst } },
  insert: () => ({
    values: (values: unknown) => {
      txInsertValues(values)
      return { returning: () => Promise.resolve([{ id: "new-template" }]) }
    },
  }),
  update: () => ({
    set: (values: unknown) => {
      txUpdateSet(values)
      return { where: () => Promise.resolve() }
    },
  }),
  delete: () => ({
    where: () => {
      txDelete()
      return Promise.resolve()
    },
  }),
}

const exportedBoard = {
  version: "2.0",
  metadata: {
    title: "Board",
    rows: 2,
    columns: 2,
    bingoType: "standard",
    completeBoardBonusXP: 10,
  },
  tiles: [
    {
      title: "A",
      description: "",
      weight: 5,
      index: 0,
      isHidden: true,
      tier: 0,
    },
  ],
}

const validDetails = {
  title: "My template",
  description: "desc",
  category: "PvM",
  tags: "boss, raids",
  isPublic: true,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockDb.transaction.mockImplementation((cb: (t: typeof tx) => unknown) =>
    cb(tx)
  )
  mockDb.update.mockReturnValue({
    set: () => ({ where: () => Promise.resolve() }),
  })
  session.mockResolvedValue({ user: { id: "owner" } })
})

describe("saveBingoAsTemplate", () => {
  it("rejects an empty title before touching the board", async () => {
    const result = await saveBingoAsTemplate("b1", {
      ...validDetails,
      title: "  ",
    })

    expect(result.success).toBe(false)
    expect(exportBoard).not.toHaveBeenCalled()
  })

  it("requires a session", async () => {
    session.mockResolvedValue(null)

    await expect(saveBingoAsTemplate("b1", validDetails)).resolves.toEqual({
      success: false,
      error: "Unauthorized",
    })
  })

  it("surfaces export (authorization) errors without inserting", async () => {
    exportBoard.mockResolvedValue({ error: "Forbidden" })

    const result = await saveBingoAsTemplate("b1", validDetails)

    expect(result).toEqual({ success: false, error: "Forbidden" })
    expect(txInsertValues).not.toHaveBeenCalled()
  })

  it("stores the summary columns next to the document and normalises tags", async () => {
    exportBoard.mockResolvedValue(exportedBoard)

    const result = await saveBingoAsTemplate("b1", validDetails)

    expect(result).toEqual({ success: true, templateId: "new-template" })
    expect(txInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorId: "owner",
        originalBingoId: "b1",
        tags: "boss,raids",
        schemaVersion: "2.0",
        bingoType: "standard",
        rows: 2,
        columns: 2,
        tileCount: 1,
        totalXp: 15,
        hasPatternBonuses: true,
        hasHiddenTiles: true,
      })
    )
    expect(revalidate).toHaveBeenCalledWith("/templates")
  })
})

describe("updateTemplate", () => {
  it("requires a session", async () => {
    session.mockResolvedValue(null)

    await expect(updateTemplate("t1", validDetails)).resolves.toEqual({
      success: false,
      error: "Unauthorized",
    })
  })

  it("validates input before reading the database", async () => {
    const result = await updateTemplate("t1", {
      ...validDetails,
      tags: "a,b,c,d,e,f",
    })

    expect(result.success).toBe(false)
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it("rejects an unknown template", async () => {
    txFindFirst.mockResolvedValue(undefined)

    await expect(updateTemplate("t1", validDetails)).resolves.toEqual({
      success: false,
      error: "Template not found",
    })
    expect(txUpdateSet).not.toHaveBeenCalled()
  })

  it("rejects users who are not the creator", async () => {
    session.mockResolvedValue({ user: { id: "intruder" } })
    txFindFirst.mockResolvedValue({ creatorId: "owner" })

    const result = await updateTemplate("t1", validDetails)

    expect(result.success).toBe(false)
    expect(txUpdateSet).not.toHaveBeenCalled()
    expect(revalidate).not.toHaveBeenCalled()
  })

  it("updates the details and revalidates the affected pages", async () => {
    txFindFirst.mockResolvedValue({ creatorId: "owner" })

    const result = await updateTemplate("t1", {
      ...validDetails,
      title: "  Renamed  ",
      isPublic: false,
    })

    expect(result).toEqual({ success: true })
    expect(txUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Renamed",
        tags: "boss,raids",
        isPublic: false,
      })
    )
    expect(revalidate).toHaveBeenCalledWith("/templates")
    expect(revalidate).toHaveBeenCalledWith("/templates/my-templates")
    expect(revalidate).toHaveBeenCalledWith("/templates/t1")
  })

  it("never changes the stored board", async () => {
    txFindFirst.mockResolvedValue({ creatorId: "owner" })

    await updateTemplate("t1", validDetails)

    expect(txUpdateSet.mock.calls[0]?.[0]).not.toHaveProperty("templateData")
  })

  it("returns an error instead of throwing when the database fails", async () => {
    mockDb.transaction.mockRejectedValue(new Error("db down"))

    await expect(updateTemplate("t1", validDetails)).resolves.toEqual({
      success: false,
      error: "Failed to update template",
    })
  })
})

describe("deleteTemplate", () => {
  it("only lets the creator delete", async () => {
    session.mockResolvedValue({ user: { id: "intruder" } })
    txFindFirst.mockResolvedValue({ creatorId: "owner" })

    const result = await deleteTemplate("t1")

    expect(result.success).toBe(false)
    expect(txDelete).not.toHaveBeenCalled()
  })

  it("deletes for the creator", async () => {
    txFindFirst.mockResolvedValue({ creatorId: "owner" })

    await expect(deleteTemplate("t1")).resolves.toEqual({ success: true })
    expect(txDelete).toHaveBeenCalledTimes(1)
  })
})

describe("importTemplateIntoEvent", () => {
  const stored = (overrides: Record<string, unknown> = {}) => ({
    isPublic: false,
    creatorId: "owner",
    templateData: JSON.stringify(exportedBoard),
    ...overrides,
  })

  it("requires a session", async () => {
    session.mockResolvedValue(null)

    await expect(importTemplateIntoEvent("t1", "e1")).resolves.toEqual({
      success: false,
      error: "Unauthorized",
    })
  })

  it("does not import private templates of other users or count them", async () => {
    session.mockResolvedValue({ user: { id: "intruder" } })
    findFirst.mockResolvedValue(stored())

    await expect(importTemplateIntoEvent("t1", "e1")).resolves.toEqual({
      success: false,
      error: "Template not found",
    })
    expect(importBoard).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it("imports public templates for any signed-in user and counts the download", async () => {
    session.mockResolvedValue({ user: { id: "someone" } })
    findFirst.mockResolvedValue(stored({ isPublic: true }))
    importBoard.mockResolvedValue({ success: true, bingoId: "b9" })

    const result = await importTemplateIntoEvent("t1", "e1")

    expect(result).toEqual({ success: true, bingoId: "b9" })
    expect(importBoard).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ version: "2.0" })
    )
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it("does not count a download when the import is refused", async () => {
    findFirst.mockResolvedValue(stored())
    importBoard.mockResolvedValue({ success: false, error: "Forbidden" })

    await expect(importTemplateIntoEvent("t1", "e1")).resolves.toEqual({
      success: false,
      error: "Forbidden",
    })
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it("reports corrupt stored data instead of throwing", async () => {
    findFirst.mockResolvedValue(stored({ templateData: "{nope" }))

    const result = await importTemplateIntoEvent("t1", "e1")

    expect(result.success).toBe(false)
    expect(importBoard).not.toHaveBeenCalled()
  })

  it("still succeeds when only the counter update fails", async () => {
    findFirst.mockResolvedValue(stored())
    importBoard.mockResolvedValue({ success: true, bingoId: "b9" })
    mockDb.update.mockImplementation(() => {
      throw new Error("db down")
    })

    await expect(importTemplateIntoEvent("t1", "e1")).resolves.toEqual({
      success: true,
      bingoId: "b9",
    })
  })
})
