/**
 * @jest-environment node
 *
 * Grep gate (RBAC 3/8, #186): no code outside the membership helper may write
 * `event_participants` or `clan_members`. Every other write would skip the
 * owner / last-admin invariants and the role ledger. Reads are fine.
 *
 * Scanned: everything under src/ except test files, the schema and the helper
 * itself. Migrations (drizzle/), seeding scripts and Playwright fixtures
 * (tests/) live outside src/ and are not scanned.
 */
import fs from "node:fs"
import path from "node:path"

const SRC = path.resolve(__dirname, "../..")

/** The one module allowed to write the membership tables. */
const HELPER = "server/authz/membership.ts"

/** Files that are never application code. */
const EXCLUDED = [HELPER, "server/db/schema.ts"]

/**
 * Explicit allowlist of other files that may write these tables, each with the
 * reason. Empty: buy-in and donation updates write `event_buy_ins` /
 * `event_donations`, not the membership tables, and are not matched. Add an
 * entry only for a write that touches neither role nor membership (for
 * example a plain `updated_at` touch), and say why.
 */
const ALLOWLIST: Record<string, string> = {}

const TABLES = "(?:eventParticipants|clanMembers)"
const WRITE_PATTERNS: [string, RegExp][] = [
  [
    "Drizzle write",
    new RegExp(`\\.(?:insert|update|delete)\\(\\s*(?:schema\\.)?${TABLES}\\b`),
  ],
  [
    "raw SQL write",
    /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:"?public"?\.)?"?(?:bingoscape-next_)?(?:event_participants|clan_members)"?/i,
  ],
  [
    // An alias would hide the table from the patterns above.
    "aliased import",
    new RegExp(`\\b${TABLES}\\s+as\\s+\\w+`),
  ],
]

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "__tests__" || entry.name === "node_modules"
        ? []
        : sourceFiles(full)
    }
    return /\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name) &&
      !/\.test\./.test(entry.name)
      ? [full]
      : []
  })
}

/** Strips comments so documentation about the tables does not trip the gate. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

export function findMembershipWrites(source: string): string[] {
  const code = withoutComments(source)
  return WRITE_PATTERNS.filter(([, pattern]) => pattern.test(code)).map(
    ([name]) => name
  )
}

describe("membership write gate", () => {
  it("recognises the ways of writing the membership tables", () => {
    expect(
      findMembershipWrites(`await tx.insert(eventParticipants).values(x)`)
    ).toEqual(["Drizzle write"])
    expect(
      findMembershipWrites(`await db\n  .delete(\n    clanMembers\n  )`)
    ).toEqual(["Drizzle write"])
    expect(
      findMembershipWrites(`tx.update(schema.eventParticipants).set({})`)
    ).toEqual(["Drizzle write"])
    expect(
      findMembershipWrites(
        `sql\`UPDATE "bingoscape-next_event_participants" SET role = 'admin'\``
      )
    ).toEqual(["raw SQL write"])
    expect(
      findMembershipWrites(`import { clanMembers as cm } from "x"`)
    ).toEqual(["aliased import"])
  })

  it("ignores reads, other tables and comments", () => {
    expect(
      findMembershipWrites(
        [
          `db.select().from(eventParticipants)`,
          `tx.query.clanMembers.findMany({})`,
          `tx.delete(eventBuyIns).where(eq(eventBuyIns.eventParticipantId, id))`,
          `tx.update(teamMembers).set({})`,
          `// tx.insert(eventParticipants) is only documented here`,
          `/* UPDATE event_participants */`,
        ].join("\n")
      )
    ).toEqual([])
  })

  it("finds no role or membership write outside the helper", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(SRC)) {
      const relative = path.relative(SRC, file).split(path.sep).join("/")
      if (EXCLUDED.includes(relative) || relative in ALLOWLIST) continue
      const found = findMembershipWrites(fs.readFileSync(file, "utf8"))
      if (found.length > 0) offenders.push(`${relative}: ${found.join(", ")}`)
    }
    expect(offenders).toEqual([])
  })

  it("keeps the allowlist honest: every entry exists and still needs it", () => {
    for (const [relative, reason] of Object.entries(ALLOWLIST)) {
      expect(reason.length).toBeGreaterThan(20)
      const file = path.join(SRC, relative)
      expect(fs.existsSync(file)).toBe(true)
      expect(findMembershipWrites(fs.readFileSync(file, "utf8"))).not.toEqual(
        []
      )
    }
  })

  it("the helper itself is where the writes are", () => {
    const helper = fs.readFileSync(path.join(SRC, HELPER), "utf8")
    expect(findMembershipWrites(helper)).toEqual(["Drizzle write"])
  })
})
