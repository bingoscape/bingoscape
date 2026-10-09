/**
 * @jest-environment node
 */
import { describe, expect, it, jest } from "@jest/globals"
import { PgDialect } from "drizzle-orm/pg-core"

jest.mock("@/server/db", () => ({ db: {} }))

import { completedAtOnComplete } from "@/lib/completed-at"

describe("completedAtOnComplete", () => {
  it("stamps with clock_timestamp() only when previous status is not completed", () => {
    const { sql: text } = new PgDialect().sqlToQuery(completedAtOnComplete)
    expect(text).toContain("clock_timestamp()")
    expect(text).not.toMatch(/now\(\)/i)
    expect(text).toMatch(/"status" <> 'completed'/)
    expect(text).toMatch(/ELSE .*"completed_at" END/)
  })
})
