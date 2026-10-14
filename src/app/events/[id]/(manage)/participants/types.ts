
import type { EventRole } from "@/lib/authz/roles"

export interface Participant {
  id: string
  runescapeName: string
  hasOverride?: boolean
  originalRunescapeName?: string
  role: EventRole
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
