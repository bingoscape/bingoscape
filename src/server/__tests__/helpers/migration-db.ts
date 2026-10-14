import fs from "node:fs"
import path from "node:path"

import postgres from "postgres"

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../drizzle")

/** Migration tags in journal order (the order drizzle applies them). */
export function migrationTags(): string[] {
  const journal = JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")
  ) as { entries: { tag: string }[] }
  return journal.entries.map((e) => e.tag)
}

/** The statements of one migration file, split like drizzle's migrator does. */
export function migrationStatements(tag: string): string[] {
  return fs
    .readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface MigrationDb {
  sql: postgres.Sql
  /** Applies one migration file inside a transaction, like `drizzle-kit migrate`. */
  apply: (tag: string) => Promise<void>
  /** Applies every migration up to and including `tag`. */
  applyThrough: (tag: string) => Promise<void>
  close: () => Promise<void>
}

/**
 * Creates an empty database next to the Jest one and returns helpers to apply
 * the real migration files to it (the Jest database itself is built with
 * `drizzle-kit push`, which cannot reproduce a pre-migration state).
 */
export async function createMigrationDb(): Promise<MigrationDb> {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) throw new Error("DATABASE_URL is not set")
  const name = `migtest_${Math.random().toString(36).slice(2, 10)}`

  const admin = postgres(baseUrl, { max: 1 })
  await admin.unsafe(`CREATE DATABASE "${name}"`)
  await admin.end()

  const url = new URL(baseUrl)
  url.pathname = `/${name}`
  const sql = postgres(url.toString(), { max: 2, onnotice: () => undefined })

  const apply = async (tag: string) => {
    const statements = migrationStatements(tag)
    await sql.begin(async (tx) => {
      for (const statement of statements) await tx.unsafe(statement)
    })
  }

  return {
    sql,
    apply,
    applyThrough: async (tag) => {
      for (const t of migrationTags()) {
        await apply(t)
        if (t === tag) return
      }
      throw new Error(`Unknown migration ${tag}`)
    },
    close: async () => {
      await sql.end()
      const dropper = postgres(baseUrl, { max: 1 })
      await dropper.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
      await dropper.end()
    },
  }
}
