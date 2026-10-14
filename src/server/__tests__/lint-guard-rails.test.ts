/**
 * @jest-environment node
 *
 * The lint guard rails of RBAC 8/8 (#191) behave as documented: no role string
 * comparisons outside the policy, and explicit `columns` on user relations.
 * They are the oxlint plugin in tools/oxlint, scoped by .oxlintrc.json. Each
 * run is a child process of the real oxlint binary on sample files in a
 * temporary project that uses a copy of the repo's config, so the overrides
 * (which paths are exempt) are tested too.
 */
import { execFileSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

const ROOT = path.resolve(__dirname, "../../..")
const OXLINT = path.join(ROOT, "node_modules/oxlint/bin/oxlint")

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rbac-lint-"))
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

// Comments are allowed in .oxlintrc.json, so strip them before parsing.
const config = JSON.parse(
  fs
    .readFileSync(path.join(ROOT, ".oxlintrc.json"), "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
)
config.jsPlugins = [path.join(ROOT, "tools/oxlint/rbac-plugin.mjs")]
fs.writeFileSync(path.join(tmp, ".oxlintrc.json"), JSON.stringify(config))

interface Diagnostic {
  code: string
  labels: { span: { line: number } }[]
}

/** Lines of `lines` (1-based) that the RBAC rules report on. */
function flaggedLines(filePath: string, lines: string[]): number[] {
  const full = path.join(tmp, filePath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, lines.join("\n"))
  let stdout: string
  try {
    stdout = execFileSync(
      process.execPath,
      [
        OXLINT,
        "-c",
        path.join(tmp, ".oxlintrc.json"),
        "--format",
        "json",
        full,
      ],
      { cwd: tmp, encoding: "utf8" }
    )
  } catch (error) {
    // oxlint exits 1 when it reports errors; the JSON is on stdout.
    stdout = (error as { stdout: string }).stdout
  }
  const { diagnostics } = JSON.parse(stdout) as { diagnostics: Diagnostic[] }
  return [
    ...new Set(
      diagnostics
        .filter((d) => d.code.startsWith("rbac("))
        .map((d) => d.labels[0]!.span.line)
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
