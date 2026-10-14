import fs from "fs"
import path from "path"
import { parse } from "@babel/parser"

/**
 * Finds the public entry points of the app by reading the source, so nothing
 * has to be listed by hand: every runtime export of a `"use server"` file (each
 * is a public endpoint callable from the browser) and every HTTP method handler
 * exported from a route file.
 */

const ROOT = path.resolve(__dirname, "../../../..")
const SRC = path.join(ROOT, "src")

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const

export interface EntryPoint {
  /** Registry key: `<path relative to the repo root>#<export name>`. */
  key: string
  file: string
  name: string
  kind: "action" | "route"
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__tests__") continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

export type ParsedSource = ReturnType<typeof parse>["program"]

/** Parses TypeScript/TSX source. TypeScript 7 has no JS compiler API. */
export function parseSource(code: string, file = "x.ts"): ParsedSource {
  return parse(code, {
    sourceType: "module",
    plugins: file.endsWith("x") ? ["typescript", "jsx"] : ["typescript"],
  }).program
}

/** True when the file starts with a `"use server"` directive. */
function isUseServer(source: ParsedSource): boolean {
  return source.directives.some((d) => d.value.value === "use server")
}

/** Names of the runtime (value) exports of a module. */
export function runtimeExports(source: ParsedSource): string[] {
  const names: string[] = []
  for (const statement of source.body) {
    if (statement.type === "ExportDefaultDeclaration") {
      names.push("default")
    } else if (statement.type === "ExportAllDeclaration") {
      if (statement.exportKind === "type") continue
      names.push("*")
    } else if (statement.type === "ExportNamedDeclaration") {
      if (statement.exportKind === "type") continue
      const decl = statement.declaration
      if (decl) {
        if (
          decl.type === "FunctionDeclaration" ||
          decl.type === "ClassDeclaration"
        ) {
          names.push(decl.id?.name ?? "default")
        } else if (decl.type === "TSEnumDeclaration") {
          names.push(decl.id.name)
        } else if (decl.type === "VariableDeclaration") {
          for (const d of decl.declarations) {
            if (d.id.type === "Identifier") names.push(d.id.name)
          }
        }
        // Interfaces, type aliases and declare statements have no runtime value.
      }
      for (const spec of statement.specifiers) {
        if (spec.type === "ExportSpecifier") {
          if (spec.exportKind === "type") continue
          names.push(
            spec.exported.type === "Identifier"
              ? spec.exported.name
              : spec.exported.value
          )
        } else if (spec.type === "ExportNamespaceSpecifier") {
          names.push(spec.exported.name)
        }
      }
    }
  }
  return names
}

export function findEntryPoints(): EntryPoint[] {
  const entries: EntryPoint[] = []
  for (const file of walk(SRC)) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/")
    const isRoute = /(^|\/)route\.ts$/.test(rel) && rel.startsWith("src/app/")
    const text = fs.readFileSync(file, "utf8")
    // Cheap pre-filter before parsing.
    if (!isRoute && !text.includes("use server")) continue

    const source = parseSource(text, file)
    if (isRoute) {
      for (const name of runtimeExports(source)) {
        if ((HTTP_METHODS as readonly string[]).includes(name)) {
          entries.push({
            key: `${rel}#${name}`,
            file: rel,
            name,
            kind: "route",
          })
        }
      }
    } else if (isUseServer(source)) {
      for (const name of runtimeExports(source)) {
        entries.push({ key: `${rel}#${name}`, file: rel, name, kind: "action" })
      }
    }
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key))
}

export function readRepoFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

export { ROOT, SRC, walk }
