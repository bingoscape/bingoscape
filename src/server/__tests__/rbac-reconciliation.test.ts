/**
 * @jest-environment node
 *
 * The daily RBAC reconciliation job: report shape, alerting on non-zero, the
 * authenticated cron route, and that every verification query runs against the
 * real schema.
 */
import { GET } from "@/app/api/cron/rbac-reconcile/route"
import {
  RBAC_VERIFICATION_CHECKS,
  type VerificationExecutor,
} from "@/server/authz/verification"
import { reconcileRbac } from "@/server/authz/reconciliation"

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

const CLEAN: VerificationExecutor = async () => []

/** Returns rows for the listed check ids (matched by the SQL text), none otherwise. */
function executorWith(
  rowsById: Record<string, Record<string, unknown>[]>,
  failing: string[] = []
): VerificationExecutor {
  return async (query) => {
    const check = RBAC_VERIFICATION_CHECKS.find((c) => c.sql === query)!
    if (failing.includes(check.id)) throw new Error("relation does not exist")
    return rowsById[check.id] ?? []
  }
}

describe("reconcileRbac", () => {
  it("is ok when every check comes back empty", async () => {
    const report = await reconcileRbac(CLEAN)
    expect(report).toMatchObject({
      ok: true,
      checks: RBAC_VERIFICATION_CHECKS.length,
      failures: [],
      warnings: [],
    })
  })

  it("alerts on a non-zero error check, with a sample of the rows", async () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ event_id: `e${i}` }))
    const report = await reconcileRbac(
      executorWith({ events_without_admin: rows })
    )
    expect(report.ok).toBe(false)
    expect(report.failures).toHaveLength(1)
    expect(report.failures[0]).toMatchObject({
      id: "events_without_admin",
      severity: "error",
      rowCount: 9,
    })
    expect(report.failures[0]!.sample).toHaveLength(5)
  })

  it("alerts on ledger drift", async () => {
    const report = await reconcileRbac(
      executorWith({
        ledger_drift: [
          {
            scope_type: "event",
            live_role: "admin",
            ledger_role: "participant",
          },
        ],
      })
    )
    expect(report.ok).toBe(false)
    expect(report.failures.map((f) => f.id)).toEqual(["ledger_drift"])
  })

  it("keeps warnings out of the failures", async () => {
    const report = await reconcileRbac(
      executorWith({ duplicate_usernames: [{ username: "x", row_count: 2 }] })
    )
    expect(report.ok).toBe(true)
    expect(report.warnings.map((w) => w.id)).toEqual(["duplicate_usernames"])
  })

  it("treats a check that cannot run as a failure", async () => {
    const report = await reconcileRbac(executorWith({}, ["ledger_drift"]))
    expect(report.ok).toBe(false)
    expect(report.failures[0]).toMatchObject({
      id: "ledger_drift",
      error: "relation does not exist",
    })
  })

  it("runs every verification query against the real schema", async () => {
    const report = await reconcileRbac()
    // Other suites leave rows behind, so findings are possible; errors are not.
    expect(
      [...report.failures, ...report.warnings].filter((f) => f.error)
    ).toEqual([])
    expect(report.checks).toBe(RBAC_VERIFICATION_CHECKS.length)
  })
})

describe("GET /api/cron/rbac-reconcile", () => {
  const original = process.env.CRON_SECRET
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = original
  })

  const call = (authorization?: string) =>
    GET(
      new Request("http://localhost/api/cron/rbac-reconcile", {
        headers: authorization ? { authorization } : {},
      })
    )

  it("fails closed while CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET
    expect((await call("Bearer undefined")).status).toBe(401)
    expect((await call()).status).toBe(401)
  })

  it("rejects a wrong token", async () => {
    process.env.CRON_SECRET = "s3cret"
    expect((await call("Bearer nope")).status).toBe(401)
    expect((await call()).status).toBe(401)
  })

  it("answers with the report for the right token", async () => {
    process.env.CRON_SECRET = "s3cret"
    const response = await call("Bearer s3cret")
    expect([200, 500]).toContain(response.status)
    const body = (await response.json()) as { ok: boolean; checks: number }
    expect(body.checks).toBe(RBAC_VERIFICATION_CHECKS.length)
    expect(response.status).toBe(body.ok ? 200 : 500)
  })
})
