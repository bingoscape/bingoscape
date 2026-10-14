import "server-only"

import { startDraftSweeper } from "./expire"

/**
 * Starts the pick timer sweeper when the server boots (see
 * `src/instrumentation.ts`). Skipped while `next build` runs: it renders pages
 * in worker processes that must not touch the database timer.
 */
export function startDraftSweeperOnBoot(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return
  startDraftSweeper()
}
