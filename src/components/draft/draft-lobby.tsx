"use client"

import Link from "next/link"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useDraftLobby } from "@/hooks/use-draft-lobby"

interface DraftLobbyProps {
  eventId: string
  /** `capabilities.canManageDraft`: managers can set the draft up from here. */
  canManage: boolean
}

/**
 * The draft room before the Event has a draft: a waiting room that turns into
 * the room by itself once a manager sets one up (see `useDraftLobby`).
 */
export function DraftLobby({ eventId, canManage }: DraftLobbyProps) {
  useDraftLobby(eventId)
  return (
    <div className="rounded-sm border border-dashed p-8 text-center">
      <p className="mb-2 flex items-center justify-center gap-2 font-medium">
        <Loader2
          className="h-4 w-4 motion-safe:animate-spin"
          aria-hidden="true"
        />
        Waiting for the draft
      </p>
      <p className="text-muted-foreground mb-4" role="status">
        {canManage
          ? "This event has no team draft yet."
          : "A manager has not set up the team draft yet."}{" "}
        This page opens the draft room by itself as soon as there is one.
      </p>
      {canManage && (
        <Button asChild>
          <Link href={`/events/${eventId}/draft/setup`}>Set up a draft</Link>
        </Button>
      )}
    </div>
  )
}
