import "server-only"

import { sql } from "drizzle-orm"

import { logger } from "@/lib/logger"
import { db } from "@/server/db"
import {
  RBAC_VERIFICATION_CHECKS,
  runRbacVerification,
  type VerificationExecutor,
  type VerificationResult,
} from "./verification"

/** One finding of the reconciliation, trimmed for logs and the alert. */
export interface ReconciliationFinding {
  id: string
  description: string
  severity: "error" | "warn"
  rowCount: number
  /** Set when the query itself failed (counts as a violation). */
  error?: string
  /** The first few offending rows. */
  sample: Record<string, unknown>[]
}

export interface ReconciliationReport {
  /** True when no `error` check found anything and none failed to run. */
  ok: boolean
  checkedAt: string
  checks: number
  failures: ReconciliationFinding[]
  warnings: ReconciliationFinding[]
}

const SAMPLE_ROWS = 5

const databaseExecutor: VerificationExecutor = async (query) =>
  [...(await db.execute(sql.raw(query)))] as Record<string, unknown>[]

function toFinding(result: VerificationResult): ReconciliationFinding {
  return {
    id: result.id,
    description: result.description,
    severity: result.severity,
    rowCount: result.rows.length,
    ...(result.error ? { error: result.error } : {}),
    sample: result.rows.slice(0, SAMPLE_ROWS),
  }
}

/**
 * The daily reconciliation: runs the RBAC verification queries (membership
 * duplicates, Events and Clans without admin, owner not admin, ledger drift,
 * missing indexes, ...) and reports every non-zero result. Read-only. A check
 * that cannot run is reported as a failure, never skipped.
 */
export async function reconcileRbac(
  execute: VerificationExecutor = databaseExecutor
): Promise<ReconciliationReport> {
  const results = await runRbacVerification(execute)
  const failures = results
    .filter(
      (r) =>
        r.error !== undefined || (r.severity === "error" && r.rows.length > 0)
    )
    .map(toFinding)
  const warnings = results
    .filter(
      (r) => r.error === undefined && r.severity === "warn" && r.rows.length > 0
    )
    .map(toFinding)

  const report: ReconciliationReport = {
    ok: failures.length === 0,
    checkedAt: new Date().toISOString(),
    checks: RBAC_VERIFICATION_CHECKS.length,
    failures,
    warnings,
  }

  if (failures.length > 0) {
    logger.error(
      {
        failures: failures.map((f) => ({
          id: f.id,
          rows: f.rowCount,
          error: f.error,
        })),
      },
      "RBAC reconciliation found violations"
    )
  } else if (warnings.length > 0) {
    logger.warn(
      { warnings: warnings.map((w) => ({ id: w.id, rows: w.rowCount })) },
      "RBAC reconciliation finished with warnings"
    )
  } else {
    logger.info({ checks: report.checks }, "RBAC reconciliation is clean")
  }
  return report
}
