import fs from "fs"
import path from "path"
import ts from "typescript"

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

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === kind)
  )
}

/** True when the file starts with a `"use server"` directive. */
function isUseServer(source: ts.SourceFile): boolean {
  for (const statement of source.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression)
    ) {
      if (statement.expression.text === "use server") return true
      continue
    }
    break
  }
  return false
}

/** Names of the runtime (value) exports of a module. */
export function runtimeExports(source: ts.SourceFile): string[] {
  const names: string[] = []
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
        names.push(
          hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
            ? "default"
            : (statement.name?.text ?? "default")
        )
      }
    } else if (ts.isVariableStatement(statement)) {
      if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
        for (const decl of statement.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) names.push(decl.name.text)
        }
      }
    } else if (ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) {
      if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
        names.push(statement.name?.text ?? "default")
      }
    } else if (ts.isExportAssignment(statement)) {
      names.push("default")
    } else if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue
      if (!statement.exportClause) {
        names.push("*")
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const el of statement.exportClause.elements) {
          if (!el.isTypeOnly) names.push(el.name.text)
        }
      } else {
        names.push(statement.exportClause.name.text)
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

    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    if (isRoute) {
      for (const name of runtimeExports(source)) {
        if ((HTTP_METHODS as readonly string[]).includes(name)) {
          entries.push({ key: `${rel}#${name}`, file: rel, name, kind: "route" })
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
