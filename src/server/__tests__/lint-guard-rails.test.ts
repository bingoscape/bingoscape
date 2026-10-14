/**
 * @jest-environment node
 *
 * The ESLint guard rails of RBAC 8/8 (#191) behave as documented: no role
 * string comparisons outside the policy, and explicit `columns` on user
 * relations. They replace the grep gate of phases 5 and 6. ESLint's flat config
 * is ESM, which Jest cannot load in-process, so each run is a child process on
 * stdin (one run per file location, one sample per line).
 */
import { execFileSync } from "child_process"
import path from "path"

const ROOT = path.resolve(__dirname, "../../..")
const ESLINT = path.join(ROOT, "node_modules/eslint/bin/eslint.js")

interface Message {
  ruleId: string | null
  line: number
}

/** Lines of `lines` (1-based) on which `no-restricted-syntax` reports. */
function flaggedLines(filePath: string, lines: string[]): number[] {
  let stdout: string
  try {
    stdout = execFileSync(
      process.execPath,
      [
        ESLINT,
        "--stdin",
        "--stdin-filename",
        path.join(ROOT, filePath),
        "--format",
        "json",
      ],
      { cwd: ROOT, input: lines.join("\n"), encoding: "utf8" }
    )
  } catch (error) {
    // ESLint exits 1 when it reports errors; the JSON is on stdout.
    stdout = (error as { stdout: string }).stdout
  }
  const [result] = JSON.parse(stdout) as [{ messages: Message[] }]
  return [
    ...new Set(
      result.messages
        .filter((m) => m.ruleId === "no-restricted-syntax")
        .map((m) => m.line)
    ),
  ]
}

const APP_FILE = "src/components/guard-rails-sample.tsx"

const FLAGGED_ROLE_SAMPLES = [
  'export const a1 = (role: string) => role === "admin"',
  'export const a2 = (role: string) => role !== "management"',
  'export const a3 = (role: string) => "admin" == role',
  'export const a4 = (role: string) => { switch (role) { case "admin": return 1; default: return 2 } }',
  'export const a5 = (role: string) => ["admin", "management"].includes(role)',
  'export const a6 = (roles: string[]) => roles.includes("management")',
  'export const a7 = ["admin", "management"]',
]
const CLEAN_ROLE_SAMPLES = [
  'export const b1 = (role: string) => role === "participant" || role === "owner"',
  'export const b2 = (role: string) => ["participant", "guest"].includes(role)',
]

const USER_PREAMBLE =
  "declare const db: { query: { x: { findMany: (o: unknown) => unknown } } }"
const query = (name: string, relation: string) =>
  `export const ${name} = db.query.x.findMany({ with: { ${relation} } })`
const FLAGGED_USER_SAMPLES = [
  query("c1", "user: true"),
  query("c2", "creator: true"),
  query("c3", "reviewer: { with: { team: true } }"),
]
const CLEAN_USER_SAMPLES = [
  query("d1", "user: { columns: { id: true, name: true } }"),
  query("d2", "reviewer: { columns: { id: true }, with: { team: true } }"),
  query("d3", "team: true"),
]

describe("role comparison lint rule", () => {
  const lines = [...FLAGGED_ROLE_SAMPLES, ...CLEAN_ROLE_SAMPLES]

  it("flags every role comparison outside the policy and nothing else", () => {
    expect(flaggedLines(APP_FILE, lines)).toEqual(
      FLAGGED_ROLE_SAMPLES.map((_, i) => i + 1)
    )
  })

  it.each(["src/lib/authz/sample.ts", "src/server/authz/sample.ts"])(
    "allows them inside %s",
    (file) => {
      expect(flaggedLines(file, FLAGGED_ROLE_SAMPLES)).toEqual([])
    }
  )

  it("allows them in tests", () => {
    expect(
      flaggedLines("src/server/__tests__/sample.test.ts", FLAGGED_ROLE_SAMPLES)
    ).toEqual([])
  })
})

describe("user relation lint rule", () => {
  const lines = [USER_PREAMBLE, ...FLAGGED_USER_SAMPLES, ...CLEAN_USER_SAMPLES]

  it("flags a user relation without columns and nothing else", () => {
    expect(flaggedLines(APP_FILE, lines)).toEqual(
      FLAGGED_USER_SAMPLES.map((_, i) => i + 2)
    )
  })

  it("applies inside the policy directories and the tests too", () => {
    for (const file of [
      "src/server/authz/sample.ts",
      "src/server/__tests__/sample.test.ts",
    ]) {
      expect(flaggedLines(file, lines)).toEqual(
        FLAGGED_USER_SAMPLES.map((_, i) => i + 2)
      )
    }
  })
})
