export interface WomPlayerDetails {
  id: number
  username: string
  displayName: string
  type: "regular" | "ironman" | "hardcore" | "ultimate" | "unknown"
  build: "main" | "f2p" | "lvl3" | "zerker" | "def1" | "hp10" | "f2p_lvl3"
  country?: string
  status: "active" | "unranked" | "flagged" | "archived" | "banned"
  exp: number
  ehp: number
  ehb: number
  ttm: number
  tt200m: number
  registeredAt: string
  updatedAt?: string
  lastChangedAt?: string
  lastImportedAt?: string
  combatLevel: number
  latestSnapshot?: WomSnapshot
  achievements?: WomAchievement[]
}

export interface WomSnapshot {
  id: number
  playerId: number
  createdAt: string
  importedAt?: string
  data: {
    skills?: Record<
      string,
      {
        metric: string
        ehp: number
        rank: number
        level: number
        experience: number
      }
    >
    bosses?: Record<
      string,
      {
        metric: string
        ehb: number
        rank: number
        kills: number
      }
    >
    activities?: Record<
      string,
      {
        metric: string
        rank: number
        score: number
      }
    >
    computed?: Record<
      string,
      {
        metric: string
        rank: number
        value: number
      }
    >
  }
}

export interface WomAchievement {
  playerId: number
  name: string
  metric: string
  measure: "levels" | "experience" | "kills" | "score" | "value"
  threshold: number
  createdAt: string
  accuracy?: number
}

// WOM Event Types
export interface WomEvent {
  id: number
  title: string
  metric: string
  type: "classic" | "team"
  startsAt: string
  endsAt: string
  groupId?: number
  score: number
  createdAt: string
  updatedAt: string
  participantCount: number
  status: "upcoming" | "ongoing" | "finished"
  participants?: WomParticipant[]
  group?: {
    id: number
    name: string
    clanChat?: string
    score: number
  }
}

export interface WomParticipant {
  playerId: number
  competitionId: number
  teamName?: string
  createdAt: string
  updatedAt: string
  username: string
  displayName: string
  type: string
  build: string
  status: string
}

// WOM Progress Types
export interface WomPlayerProgress {
  start: number
  end: number
  gained: number
}

export interface WomPlayerEventProgress {
  playerId: number
  username: string
  displayName: string
  progress: WomPlayerProgress
  levels?: WomPlayerProgress // Only for skill metrics
}

// WOM Verification Types
export interface WomVerificationConfig {
  enabled: boolean
  type: "skill" | "boss" | "activity"
  metric: string
  threshold: number
  comparison: "greater_than" | "greater_than_equal" | "equal" | "less_than" | "less_than_equal"
  measureType: "level" | "experience" | "kills" | "score" | "value"
  verifyMode: "total" | "event_gains" // Whether to verify based on total stats or event-specific gains
  womEventId?: number // Optional WOM event ID to track progress from
}

// Extend the Tile type to include WOM verification config
declare module "@/app/actions/events" {
  interface Tile {
    womVerificationConfig?: WomVerificationConfig
  }
}

