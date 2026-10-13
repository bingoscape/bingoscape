/**
 * @jest-environment node
 */
import { eq } from "drizzle-orm"

import {
  updateSubmissionStatus,
  updateSubmissionStatusWithComment,
  updateTeamTileSubmissionStatus,
} from "@/app/actions/bingo"
import { checkAndAutoCompleteTile } from "@/app/actions/tile-completion"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  goals,
  images,
  submissions,
  teamGoalProgress,
  teamTierProgress,
  teamTileSubmissions,
} from "@/server/db/schema"
import {
  createProgressionFixture,
  type ProgressionFixture,
} from "@/server/__tests__/helpers/progression-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/app/actions/notifications", () => ({
  createNotification: jest.fn(),
}))
jest.mock("@/lib/discord-webhook", () => ({
  sendDiscordWebhook: jest.fn(),
  createSubmissionEmbed: jest.fn(),
}))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

const session = getServerAuthSession as jest.Mock

/** Tier 0 of the fixture needs 2 XP (tiles 0-2, weight 1) to open Tier 1. */
async function unlockedTiers(teamId: string) {
  const rows = await db.query.teamTierProgress.findMany({
    where: eq(teamTierProgress.teamId, teamId),
  })
  return rows
    .filter((r) => r.isUnlocked)
    .map((r) => r.tier)
    .sort()
}

/** A pending image submission of the team on the Tile at `index`. */
async function pendingSubmission(
  fx: ProgressionFixture,
  index: number
): Promise<string> {
  const [tts] = await db
    .insert(teamTileSubmissions)
    .values({
      tileId: fx.tileIds[index]!,
      teamId: fx.teamAId,
      status: "incomplete",
    })
    .returning({ id: teamTileSubmissions.id })
  const [image] = await db
    .insert(images)
    .values({ path: `/uploads/${fx.tag}-${index}` })
    .returning({ id: images.id })
  const [submission] = await db
    .insert(submissions)
    .values({
      teamTileSubmissionId: tts!.id,
      imageId: image!.id,
      submittedBy: fx.memberAId,
      status: "pending",
    })
    .returning({ id: submissions.id })
  return submission!.id
}

describe("tier unlock on tile completion", () => {
  let fx: ProgressionFixture

  beforeEach(async () => {
    fx = await createProgressionFixture()
    // The manager created the event, so the role lookup resolves to admin.
    session.mockResolvedValue({ user: { id: fx.managerId } })
  })

  afterEach(async () => {
    await fx.cleanup()
  })

  describe.each([
    ["updateSubmissionStatus", updateSubmissionStatus],
    [
      "updateSubmissionStatusWithComment",
      (id: string, status: "approved") =>
        updateSubmissionStatusWithComment(id, status),
    ],
  ])("approving a submission with %s", (_name, approve) => {
    beforeEach(async () => {
      // Tier 0 Tiles without goals complete on approval.
      await fx.removeGoals([0, 1, 2])
    })

    it("does not open the next tier while the requirement is unmet", async () => {
      const first = await pendingSubmission(fx, 0)

      expect(await approve(first, "approved")).toMatchObject({ success: true })

      // Only the always-open Tier 0 has a row.
      expect(await unlockedTiers(fx.teamAId)).toEqual([0])
    })

    it("opens the next tier once the approved Tiles reach the requirement", async () => {
      const first = await pendingSubmission(fx, 0)
      const second = await pendingSubmission(fx, 1)

      await approve(first, "approved")
      await approve(second, "approved")

      expect(await unlockedTiers(fx.teamAId)).toEqual([0, 1])
      expect(await unlockedTiers(fx.teamBId)).toEqual([])
    })
  })

  it("opens the next tier when a manager completes a Tile", async () => {
    await fx.completeTile(0, fx.teamAId)
    const second = await pendingSubmission(fx, 1)
    const tts = await db.query.submissions.findFirst({
      where: eq(submissions.id, second),
    })

    const result = await updateTeamTileSubmissionStatus(
      tts!.teamTileSubmissionId,
      "completed"
    )

    expect(result).toMatchObject({ success: true })
    expect(await unlockedTiers(fx.teamAId)).toEqual([0, 1])
  })

  it("opens the next tier for a Tile that was already completed", async () => {
    // Completed earlier without the tier rows ever being written.
    for (const index of [0, 1]) {
      await fx.completeTile(index, fx.teamAId)
      const goal = await db.query.goals.findFirst({
        where: eq(goals.tileId, fx.tileIds[index]!),
      })
      await db
        .insert(teamGoalProgress)
        .values({ teamId: fx.teamAId, goalId: goal!.id, currentValue: 1 })
    }
    expect(await unlockedTiers(fx.teamAId)).toEqual([])

    const result = await checkAndAutoCompleteTile(
      db,
      fx.tileIds[0]!,
      fx.teamAId
    )

    expect(result).toMatchObject({ alreadyApproved: true, tierUnlocked: 1 })
    expect(await unlockedTiers(fx.teamAId)).toEqual([0, 1])
  })
})
