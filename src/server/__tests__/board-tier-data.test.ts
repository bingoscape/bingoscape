/**
 * @jest-environment node
 */
import { loadTierXpRequirements } from "@/server/progression"
import { getBoardTierData } from "@/server/queries/tiers"

jest.mock("@/server/progression", () => ({
  loadTierXpRequirements: jest.fn(),
  loadTeamTierProgress: jest.fn(),
}))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

describe("getBoardTierData", () => {
  it("returns null for boards that are not progression boards", async () => {
    expect(
      await getBoardTierData({ id: "b", bingoType: "standard" }, "t")
    ).toBeNull()
  })

  it("fails instead of reporting every tier as locked", async () => {
    ;(loadTierXpRequirements as jest.Mock).mockRejectedValue(
      new Error("db down")
    )

    await expect(
      getBoardTierData({ id: "b", bingoType: "progression" }, "t")
    ).rejects.toThrow("db down")
  })
})
