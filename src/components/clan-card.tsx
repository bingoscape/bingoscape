import Link from "next/link"
import { BowArrow, ChevronRight, Crown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { CLAN_ROLE_LABELS } from "@/lib/clan"
import { cn } from "@/lib/utils"
import type { UserClanSummary } from "@/server/queries/clans"

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Clan card for the /clans list. The title is a real link stretched over the
 * whole card (after:inset-0); the main clan gets a left accent.
 */
export function ClanCard({ clan }: { clan: UserClanSummary }) {
  const ownerName = clan.owner?.runescapeName ?? clan.owner?.name ?? null
  const chipId = `clan-${clan.id}-chip`

  return (
    <article
      className={cn(
        "group osrs-panel relative flex h-full flex-col gap-3 rounded-sm p-3 transition-[filter] hover:brightness-110 has-focus-visible:ring-2 has-focus-visible:ring-ring sm:p-4",
        clan.isMain && "border-l-4 border-l-success"
      )}
    >
      <header className="flex items-start gap-3">
        <div className="osrs-slot shrink-0 rounded-sm p-2">
          <BowArrow aria-hidden="true" className="size-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="osrs-heading flex items-start justify-between gap-2 text-lg leading-snug">
            <Link
              href={`/clans/${clan.id}`}
              aria-describedby={chipId}
              className="line-clamp-2 break-words after:absolute after:inset-0 focus-visible:outline-hidden"
            >
              {clan.name}
            </Link>
            <ChevronRight
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
            />
          </h3>
          <div id={chipId} className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant={clan.isMain ? "success" : "secondary"}>
              {clan.isMain ? "Main" : "Guest"}
            </Badge>
            <Badge variant="outline">Role: {CLAN_ROLE_LABELS[clan.role]}</Badge>
          </div>
        </div>
      </header>

      <p className="line-clamp-3 text-sm text-muted-foreground">
        {clan.description?.trim() || "No description yet."}
      </p>

      <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {ownerName && (
          <>
            <span className="inline-flex items-center gap-1">
              <Crown aria-hidden="true" className="size-4 text-warning" />
              <span className="sr-only">Owner: </span>
              {ownerName}
            </span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>{plural(clan.memberCount, "member", "members")}</span>
        <span aria-hidden="true">·</span>
        <span>{plural(clan.eventCount, "event", "events")}</span>
      </p>
    </article>
  )
}
