/**
 * @jest-environment node
 *
 * Grep gate: a full `users` row carries the password hash, so source files must
 * not select it into a value that is returned to a client.
 */
import fs from "node:fs"
import path from "node:path"

const SRC = path.resolve(__dirname, "../..")

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "__tests__" || entry.name === "node_modules"
        ? []
        : sourceFiles(full)
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

const FILES = sourceFiles(SRC).map((file) => ({
  file: path.relative(SRC, file),
  text: fs.readFileSync(file, "utf8"),
}))

describe("users rows stay on the server", () => {
  it("never selects the whole users table as a nested value (`owner: users`)", () => {
    // Better Auth's adapter table mapping (`user: users`) is not a select.
    const offenders = FILES.filter(
      ({ file, text }) =>
        file !== path.join("server", "auth.ts") &&
        /^\s*\w+:\s*users,?\s*$/m.test(text)
    ).map((f) => f.file)
    expect(offenders).toEqual([])
  })

  it("has no select() of every users column", () => {
    const offenders = FILES.filter(({ text }) =>
      /\.select\(\)\s*\.from\(users\)/.test(text)
    ).map((f) => f.file)
    expect(offenders).toEqual([])
  })

  it("loads users in relational queries only with explicit columns", () => {
    const offenders: string[] = []
    for (const { file, text } of FILES) {
      for (const m of text.matchAll(
        /\b(?:user|owner|creator|reviewer|submitter|requester)\s*:\s*\{\s*(?!columns)(with|where|orderBy)\b/g
      )) {
        offenders.push(`${file}: ${m[0].replace(/\s+/g, " ")}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
