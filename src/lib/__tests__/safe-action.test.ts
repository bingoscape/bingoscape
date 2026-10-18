/**
 * @jest-environment node
 */
import { DrizzleQueryError } from "drizzle-orm/errors"

import { actionClient } from "@/lib/safe-action"
import { UserFacingError } from "@/lib/user-facing-error"
import { AuthzError } from "@/server/authz/errors"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

describe("actionClient.handleServerError", () => {
  it("does not send the SQL text or the parameters of a failed query to the client", async () => {
    const action = actionClient.action(async () => {
      // An id that is not a uuid makes PostgreSQL reject the statement.
      await db
        .insert(users)
        .values({ id: "not-a-uuid", email: "leak@example.com" })
    })

    const result = await action()

    expect(result.serverError).toBe("An unexpected error occurred")
    expect(JSON.stringify(result)).not.toMatch(
      /insert|not-a-uuid|leak@example/i
    )
  })

  it("wraps driver errors with the SQL text, which is why they must not be forwarded", () => {
    const error = new DrizzleQueryError(
      "select 1",
      ["secret"],
      new Error("boom")
    )
    expect(error.message).toContain("select 1")
    expect(error.message).toContain("secret")
  })

  it("keeps the message of an error written for the user", async () => {
    const action = actionClient.action(async () => {
      throw new UserFacingError("Profile not found")
    })
    expect((await action()).serverError).toBe("Profile not found")
  })

  it("keeps the message of an AuthzError", async () => {
    const action = actionClient.action(async () => {
      throw new AuthzError("You cannot do that", "FORBIDDEN")
    })
    expect((await action()).serverError).toBe("You cannot do that")
  })

  it("hides the message of any other error", async () => {
    const action = actionClient.action(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432")
    })
    expect((await action()).serverError).toBe("An unexpected error occurred")
  })
})
