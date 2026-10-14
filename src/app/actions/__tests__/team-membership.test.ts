/**
 * @jest-environment node
 *
 * Team membership writes keep team_members.event_id filled and honour the
 * one-Team-per-Player-per-Event rule (migration 0038), on real Postgres.
 */
import { eq } from "drizzle-orm"

import { assignParticipantToTeam } from "@/app/actions/events"
import { addUserToTeam } from "@/app/actions/team"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { teamMembers } from "@/server/db/schema"
import {
  createAuthzFixture,
  type AuthzFixture,
} from "@/server/__tests__/helpers/authz-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

let f: AuthzFixture

beforeAll(async () => {
  f = await createAuthzFixture()
})
afterAll(async () => {
  await f.cleanup()
})
beforeEach(() => {
  ;(getServerAuthSession as jest.Mock).mockResolvedValue({
    user: { id: f.users.admin },
  })
})

const membershipsOf = (userId: string) =>
  db.select().from(teamMembers).where(eq(teamMembers.userId, userId))

describe("addUserToTeam", () => {
  it("stores the Event on the new membership", async () => {
    const result = await addUserToTeam(f.event1.teamBId, f.users.participant)
    expect(result.success).toBe(true)
    expect(await membershipsOf(f.users.participant)).toEqual([
      expect.objectContaining({
        teamId: f.event1.teamBId,
        eventId: f.event1.id,
      }),
    ])
  })

  it("refuses a second Team in the same Event", async () => {
    const result = await addUserToTeam(f.event1.teamAId, f.users.memberB)
    expect(result).toEqual({
      success: false,
      error: "User is already on a team in this event",
    })
    expect(await membershipsOf(f.users.memberB)).toHaveLength(1)
  })
})

describe("assignParticipantToTeam", () => {
  it("moves the Player and fills the Event of the new membership", async () => {
    const result = await assignParticipantToTeam(
      f.event1.id,
      f.users.memberA,
      f.event1.teamBId
    )
    expect(result.success).toBe(true)
    const rows = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, f.users.memberA))
    expect(rows).toEqual([
      expect.objectContaining({
        teamId: f.event1.teamBId,
        eventId: f.event1.id,
      }),
    ])
  })
})
