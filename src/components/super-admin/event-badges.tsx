import { Globe, Lock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { EVENT_STATE_LABEL, getEventState } from "@/lib/super-admin-format"

/** Live / Upcoming / Ended: the word carries the meaning, colour only reinforces it. */
export function EventStateBadge({ start, end }: { start: Date; end: Date }) {
  const state = getEventState(start, end, new Date())
  return (
    <Badge
      variant={
        state === "active"
          ? "success"
          : state === "upcoming"
            ? "info"
            : "secondary"
      }
    >
      {EVENT_STATE_LABEL[state]}
    </Badge>
  )
}

export function EventFlagBadges({
  locked,
  isPublic,
}: {
  locked: boolean
  isPublic: boolean
}) {
  return (
    <>
      {locked ? (
        <Badge variant="warning">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Locked
        </Badge>
      ) : null}
      <Badge variant="outline">
        {isPublic ? (
          <Globe className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Lock className="h-3 w-3" aria-hidden="true" />
        )}
        {isPublic ? "Public" : "Private"}
      </Badge>
    </>
  )
}
