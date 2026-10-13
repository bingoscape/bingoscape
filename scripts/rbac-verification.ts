/**
 * Runs the RBAC membership verification queries (src/server/authz/verification.ts)
 * against DATABASE_URL and prints every finding. Read-only.
 *
 * Exit code 1 when a check with severity "error" returns rows; "warn" findings
 * are printed but do not fail. Intended for a restored production backup (see
 * docs/DATABASE-MIGRATION.md, "RBAC 2/8 rollout") and reusable by the ledger
 * reconciliation job.
 *
 * Run (bundles with esbuild, loads .env through env-cmd):
 *   npm run db:verify-rbac
 */
import postgres from "postgres"

import {
  RBAC_VERIFICATION_CHECKS,
  runRbacVerification,
  violations,
} from "@/server/authz/verification"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL is not set")
    process.exit(1)
  }

  const client = postgres(url, { max: 1 })
  try {
    const results = await runRbacVerification(
      async (query) =>
        [...(await client.unsafe(query))] as Record<string, unknown>[]
    )
    for (const r of results) {
      const status = r.error
        ? "ERR "
        : r.rows.length === 0
          ? "ok  "
          : r.severity === "error"
            ? "FAIL"
            : "WARN"
      const detail = r.error ?? `${r.rows.length} row(s)`
      console.log(`${status} ${r.id}: ${detail} - ${r.description}`)
      if (r.rows.length > 0)
        console.log(JSON.stringify(r.rows.slice(0, 20), null, 2))
    }
    const failed = violations(results, "error")
    console.log(
      `${RBAC_VERIFICATION_CHECKS.length} checks, ${failed.length} failed, ${violations(results, "warn").length} warning(s)`
    )
    if (failed.length > 0) process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error("Verification failed:", error)
  process.exit(1)
})
