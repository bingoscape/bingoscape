import Link from "next/link"
import { Swords } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DraftStatus } from "@/lib/draft/types"

interface DraftEntryLinkProps {
  eventId: string
  /** The Event's live draft status, or null when it has none. */
  status: DraftStatus | null
  /** `capabilities.canManageDraft`: managers get a way to set one up. */
  canManage: boolean
  /** Only members see the draft; the Event layout already keeps others out. */
  canView: boolean
}

/**
 * The entry point to the team draft from the Event header: the room for
 * everybody once a draft exists, the setup page for managers before that.
 */
export function DraftEntryLink({
  eventId,
  status,
  canManage,
  canView,
}: DraftEntryLinkProps) {
  if (!canView) return null
  if (status === null) {
    if (!canManage) return null
    return (
      <Button variant="outline" size="sm" asChild className="gap-2">
        <Link href={`/events/${eventId}/draft/setup`}>
          <Swords className="h-4 w-4" aria-hidden="true" />
          <span>Set up draft</span>
        </Link>
      </Button>
    )
  }
  return (
    <Button variant="outline" size="sm" asChild className="gap-2">
      <Link href={`/events/${eventId}/draft`}>
        <Swords className="h-4 w-4" aria-hidden="true" />
        <span>Team draft</span>
        {status === "in_progress" && <Badge variant="success">Live</Badge>}
        {status === "paused" && <Badge variant="warning">Paused</Badge>}
      </Link>
    </Button>
  )
}
