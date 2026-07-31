/**
 * @jest-environment node
 */
import { linkRunescapeAccount } from "../user"

import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { withDb } from "@/lib/test-utils"
import { eq } from "drizzle-orm"
import { getServerAuthSession } from "@/server/auth"

jest.mock("@/server/auth", () => ({
  getServerAuthSession: jest.fn(),
}))

describe("user actions integration", () => {
  const mockGetServerAuthSession = getServerAuthSession as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("updates the runescapeName for the authenticated user", async () => {
    await withDb(async () => {
      // 1. Arrange: insert a user
      const [user] = await db
        .insert(users)
        .values({
          name: "Test User",
          email: "test@example.com",
        })
        .returning()

      if (!user) throw new Error("Failed to insert user")

      mockGetServerAuthSession.mockResolvedValue({
        user: { id: user.id },
      })

      // 2. Act: call the server action
      const result = await linkRunescapeAccount("Zezima")

      // 3. Assert: action returns success
      expect(result).toEqual({ success: true })

      // 4. Assert: database is updated
      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))

      expect(updatedUser?.runescapeName).toBe("Zezima")
    })
  })

  it("proves transaction rollback: the user from the previous test should not exist", async () => {
    await withDb(async () => {
      const allUsers = await db
        .select()
        .from(users)
        .where(eq(users.email, "test@example.com"))
      
      expect(allUsers).toHaveLength(0)
    })
  })
})
