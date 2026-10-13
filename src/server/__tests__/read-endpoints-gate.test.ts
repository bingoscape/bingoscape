/**
 * @jest-environment node
 *
 * Grep gate (RBAC 4/8, #187): a `"use server"` export is a public endpoint, so
 * the query and helper modules below must stay plain server modules. Client
 * callable entry points live in src/app/actions/ and authorize themselves.
 */
import fs from "node:fs"
import path from "node:path"

const SRC = path.resolve(__dirname, "../..")

const PLAIN_SERVER_MODULES = [
  "server/queries/events.ts",
  "server/queries/stats.ts",
  "server/queries/item-statistics.ts",
  "server/queries/event-pattern-completion.ts",
  "server/pattern-completion.ts",
  "server/tile-completion.ts",
  "server/goal-progress.ts",
  "server/authz/read.ts",
  "server/authz/uploads.ts",
  "server/blind-board-viewer.ts",
]

const USE_SERVER = /^\s*(["'])use server\1/m

describe("read helpers are not endpoints", () => {
  it.each(PLAIN_SERVER_MODULES)("%s has no 'use server' directive", (file) => {
    const source = fs.readFileSync(path.join(SRC, file), "utf8")
    expect(source).not.toMatch(USE_SERVER)
  })

  it.each(PLAIN_SERVER_MODULES.filter((f) => !f.endsWith("viewer.ts")))(
    "%s cannot be imported by a client component",
    (file) => {
      const source = fs.readFileSync(path.join(SRC, file), "utf8")
      expect(source).toMatch(/import "server-only"/)
    }
  )

  it("the client-callable read entry points authorize and stay thin", () => {
    const entry = fs.readFileSync(
      path.join(SRC, "app/actions/event-summary.ts"),
      "utf8"
    )
    expect(entry).toMatch(USE_SERVER)
    expect(entry).toMatch(/getEventById/)
  })
})
