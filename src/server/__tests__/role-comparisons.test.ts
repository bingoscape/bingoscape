/**
 * @jest-environment node
 *
 * Temporary grep gate for RBAC 5/8 (#188): no inline Event role comparisons
 * outside `src/lib/authz` and `src/server/authz`. Call sites ask the policy
 * (`authorize`, `requirePermission`, `hasPermission`, `can`) instead. The lint
 * rule that replaces this test lands in phase 8 (#191).
 */
import fs from "fs"
import path from "path"

import { ROOT, SRC, walk } from "@/server/__tests__/helpers/export-scan"

const ROLE = `"(?:admin|management)"`
const PATTERNS = [
  new RegExp(`(?:===|!==|==|!=)\\s*${ROLE}`),
  new RegExp(`${ROLE}\\s*(?:===|!==|==|!=)`),
  new RegExp(`\\.includes\\([^)]*${ROLE}`),
  new RegExp(`\\[\\s*"admin"\\s*,\\s*"management"\\s*\\]`),
]

/** Where the policy itself lives. */
const POLICY_DIRS = ["src/lib/authz/", "src/server/authz/"]

/**
 * Files that legitimately still compare a role string, each with the reason.
 * "phase 6" entries are UI code that receives a role as a prop; they move to
 * server computed capabilities in #189.
 */
const ALLOWED: Record<string, string> = {
  // Clan roles are a separate ladder from Event roles.
  "src/lib/clan.ts": "Clan role ladder, not an Event role",
  "src/components/clan-member-list.tsx":
    "Clan role display (change summary), not an Event role",
  // Not roles at all.
  "src/lib/dashboard-events.ts":
    'the "admin" filter token of the dashboard URL, not a role',
  "src/components/eventlist.tsx":
    'the "admin" filter token of the dashboard URL, not a role',
  // Super admin pages show who is the last admin of a scope.
  "src/app/super-admin/clans/[clanId]/page.tsx":
    "super-admin display of the last Clan admin",
  "src/app/super-admin/events/[eventId]/page.tsx":
    "super-admin display of the last Event admin",
  "src/components/super-admin/membership-actions.tsx":
    "super-admin display of the last admin",
  // Phase 6: UI that receives a role as a prop or fetches it on the client.
  "src/app/events/[id]/(manage)/participants/page.tsx": "phase 6",
  "src/app/events/[id]/(manage)/bingos/[bingoId]/submissions/page.tsx":
    "phase 6",
  "src/components/participants-tab.tsx": "phase 6",
  "src/components/progression-bingo-grid.tsx": "phase 6",
  "src/components/team-selector.tsx": "phase 6",
  "src/components/event-card.tsx": "phase 6",
  "src/components/tile-details-tab.tsx": "phase 6",
  "src/components/event-header-actions.tsx": "phase 6",
  "src/components/bingo-grid-layout.tsx": "phase 6",
  "src/components/bingo-tile.tsx": "phase 6",
  "src/components/bingogrid.tsx": "phase 6",
  "src/components/event-layout-header.tsx": "phase 6",
  "src/components/event-workspace/tile-panel.tsx": "phase 6",
  "src/components/event-workspace/event-workspace.tsx": "phase 6",
  "src/components/event-workspace/tier-ladder-view.tsx": "phase 6",
  "src/components/event-workspace/event-summary-bar.tsx": "phase 6",
  "src/components/dashboard/dashboard-event-card.tsx": "phase 6",
}

function matchesIn(file: string): string[] {
  const rel = path.relative(ROOT, file).split(path.sep).join("/")
  if (POLICY_DIRS.some((dir) => rel.startsWith(dir))) return []
  const lines = fs.readFileSync(file, "utf8").split("\n")
  return lines
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => !line.trim().startsWith("//"))
    .filter(({ line }) => PATTERNS.some((p) => p.test(line)))
    .map(({ line, n }) => `${rel}:${n}: ${line.trim()}`)
}

describe("inline role comparisons", () => {
  const found = new Map<string, string[]>()
  for (const file of walk(SRC)) {
    const matches = matchesIn(file)
    if (matches.length > 0) {
      found.set(path.relative(ROOT, file).split(path.sep).join("/"), matches)
    }
  }

  it("exist only in the allowlisted files", () => {
    const offenders = [...found.entries()]
      .filter(([file]) => !(file in ALLOWED))
      .flatMap(([, matches]) => matches)
    expect(offenders).toEqual([])
  })

  it("keeps the allowlist free of files that no longer need it", () => {
    const stale = Object.keys(ALLOWED).filter((file) => !found.has(file))
    expect(stale).toEqual([])
  })

  it("gives every allowlist entry a reason", () => {
    expect(
      Object.entries(ALLOWED)
        .filter(([, reason]) => reason.trim() === "")
        .map(([file]) => file)
    ).toEqual([])
  })
})
