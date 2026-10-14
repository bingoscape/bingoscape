/**
 * @jest-environment node
 *
 * Every public entry point (each export of a "use server" file and each route
 * handler method) must be registered with a policy. The entry points are found
 * by reading the source, not from a list kept by hand.
 */
import ts from "typescript"

import { PERMISSIONS } from "@/lib/authz/permissions"
import { POLICY_REGISTRY } from "@/server/authz/registry"
import {
  findEntryPoints,
  readRepoFile,
  runtimeExports,
} from "@/server/__tests__/helpers/export-scan"

const entryPoints = findEntryPoints()

describe("export scanner", () => {
  const exportsOf = (code: string) =>
    runtimeExports(ts.createSourceFile("x.ts", code, ts.ScriptTarget.Latest))

  it("sees runtime exports and ignores types", () => {
    expect(
      exportsOf(`
        export async function a() {}
        export const b = async () => {}
        export interface C {}
        export type D = string
        const e = 1
        function f() {}
        export { e, f as g }
        export type { C as H }
        export { type D as I }
        export default async function () {}
      `)
    ).toEqual(["a", "b", "e", "g", "default"])
  })

  it("flags a star re-export", () => {
    expect(exportsOf(`export * from "./other"`)).toEqual(["*"])
  })
})

describe("policy registry", () => {
  it("finds the entry points", () => {
    // A broken scanner would make the other tests pass vacuously.
    expect(entryPoints.length).toBeGreaterThan(100)
    expect(entryPoints.some((e) => e.kind === "route")).toBe(true)
    expect(entryPoints.some((e) => e.kind === "action")).toBe(true)
  })

  it("registers every server action and route handler", () => {
    const missing = entryPoints
      .filter((e) => !(e.key in POLICY_REGISTRY))
      .map((e) => e.key)
    expect(missing).toEqual([])
  })

  it("has no entry for something that no longer exists", () => {
    const known = new Set(entryPoints.map((e) => e.key))
    const stale = Object.keys(POLICY_REGISTRY).filter((key) => !known.has(key))
    expect(stale).toEqual([])
  })

  it("gives every public / authenticated entry a reason", () => {
    const withoutReason = Object.entries(POLICY_REGISTRY)
      .filter(([, entry]) => entry.kind !== "permission")
      .filter(([, entry]) => !("reason" in entry) || entry.reason.trim() === "")
      .map(([key]) => key)
    expect(withoutReason).toEqual([])
  })

  it("only names permissions that exist", () => {
    const unknown = Object.entries(POLICY_REGISTRY).flatMap(([key, entry]) =>
      "permissions" in entry && entry.permissions
        ? entry.permissions
            .filter((p) => !(PERMISSIONS as readonly string[]).includes(p))
            .map((p) => `${key}: ${p}`)
        : []
    )
    expect(unknown).toEqual([])
  })

  it("has the permission it names in the entry point's file, unless it delegates", () => {
    const problems: string[] = []
    for (const [key, entry] of Object.entries(POLICY_REGISTRY)) {
      if (entry.kind !== "permission") continue
      if (entry.note && /^(via|enforced by) /.test(entry.note)) continue
      const file = key.split("#")[0]!
      const source = readRepoFile(file)
      for (const permission of entry.permissions) {
        if (!source.includes(`"${permission}"`)) {
          problems.push(`${key}: ${permission}`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it("does not let a server action file export anything but async functions", () => {
    // next build rejects other runtime exports; this catches it earlier.
    const exportedConsts = entryPoints
      .filter((e) => e.kind === "action")
      .filter((e) => {
        const source = readRepoFile(e.file)
        return new RegExp(`export const ${e.name}\\b`).test(source)
      })
      // `authenticatedAction` clients return an async function.
      .filter((e) => e.file !== "src/app/actions/profile.ts")
      .map((e) => e.key)
    expect(exportedConsts).toEqual([])
  })
})
