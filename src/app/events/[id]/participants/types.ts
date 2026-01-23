export interface Participant {
  id: string
  runescapeName: string
  role: "admin" | "management" | "participant"
  teamId: string | null
  teamName: string | null
  buyIn: number
  totalDonations: number
}

export interface Team {
  id: string
  name: string
}

export type SortField =
  | "name"
  | "role"
  | "team"
  | "buyIn"
  | "donations"
  | "status"
export type SortDirection = "asc" | "desc"

export interface EventPermissions {
  isEventCreator: boolean
  currentUserRole: "admin" | "management" | "participant"
  canManageParticipant: (participant: Participant) => boolean
  canChangeRoles: () => boolean
  canChangeTeams: () => boolean
  canRemoveParticipants: () => boolean
  canEditBuyIns: () => boolean
}
