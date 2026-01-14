import { useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import type { Participant } from "@/app/events/[id]/participants/types"

export function useEventPermissions(eventId: string, eventCreatorId?: string) {
  const { data: session } = useSession()
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "management" | "participant">("participant")

  const isEventCreator = useMemo(() => {
    return !!(eventCreatorId && session?.user.id && eventCreatorId === session.user.id)
  }, [eventCreatorId, session?.user.id])

  // Check if current user can manage a specific participant
  const canManageParticipant = (participant: Participant) => {
    // Event creator can manage everyone
    if (isEventCreator) return true

    // Participants can't manage anyone
    if (currentUserRole === "participant") return false

    // Admins can manage everyone
    if (currentUserRole === "admin") return true

    // Management can manage participants and other management, but not admins
    if (currentUserRole === "management") {
      return participant.role !== "admin"
    }

    return false
  }

  // Check if current user can change roles
  const canChangeRoles = () => {
    return isEventCreator || currentUserRole === "admin" || currentUserRole === "management"
  }

  // Check if current user can change teams
  const canChangeTeams = () => {
    return isEventCreator || currentUserRole === "admin" || currentUserRole === "management"
  }

  // Check if current user can remove participants
  const canRemoveParticipants = () => {
    return isEventCreator || currentUserRole === "admin" || currentUserRole === "management"
  }

  // Check if current user can edit buy-ins
  const canEditBuyIns = () => {
    return isEventCreator || currentUserRole === "admin" || currentUserRole === "management"
  }

  return {
    currentUserRole,
    isEventCreator,
    setCurrentUserRole,
    canManageParticipant,
    canChangeRoles,
    canChangeTeams,
    canRemoveParticipants,
    canEditBuyIns,
  }
}
