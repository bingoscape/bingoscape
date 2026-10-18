import Link from "next/link"
import { Swords } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DraftStatus } from "@/lib/draft/types"

interface DraftEntryLinkProps {
  eventId: string
  /** The Event's live draft status, or null when it has none yet. */
  status: DraftStatus | null
  /** `capabilities.canManageDraft`: managers also get a way to set one up. */
  canManage: boolean
  /** Only members see the draft; the Event layout already keeps others out. */
  canView: boolean
}

/**
 * The entry point to the team draft from the Event header. Every member can
 * walk into the draft room ("Join live draft"), also before a draft exists:
 * the room then waits and fills in by itself once a manager sets one up.
 * Managers also get the way to set one up while there is none, and keep the
 * plain "Team draft" label once it is complete (the room links to the recap).
 */
export function DraftEntryLink({
  eventId,
  status,
  canManage,
  canView,
}: DraftEntryLinkProps) {
  if (!canView) return null
  const finished = status === "complete"
  return (
    <>
      {status === null && canManage && (
        <Button variant="outline" size="sm" asChild className="gap-2">
          <Link href={`/events/${eventId}/draft/setup`}>
            <Swords className="h-4 w-4" aria-hidden="true" />
            <span>Set up draft</span>
          </Link>
        </Button>
      )}
      <Button variant="outline" size="sm" asChild className="gap-2">
        <Link href={`/events/${eventId}/draft`}>
          {/* The icon repeats next to "Set up draft" for managers: skip it there. */}
          {!(status === null && canManage) && (
            <Swords className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{finished ? "Team draft" : "Join live draft"}</span>
          {status === "in_progress" && <Badge variant="success">Live</Badge>}
          {status === "paused" && <Badge variant="warning">Paused</Badge>}
        </Link>
      </Button>
    </>
  )
}
