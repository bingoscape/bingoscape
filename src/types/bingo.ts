export interface SelectableUser {
  id: string
  name: string | null
  runescapeName: string | null
  teamId?: string | null
  teamName?: string | null
}

export interface GoalData {
  id: string
  description: string
  createdAt: Date
  updatedAt: Date
  tileId: string
  targetValue: number
}

export interface TileData {
  id: string
  title: string
  description: string
  createdAt: Date
  updatedAt: Date
  bingoId: string
  headerImage: string | null
  weight: number
  index: number
  isHidden: boolean
  tier: number
  goals: GoalData[]
}

export interface BingoData {
  id: string
  title: string
  description: string | null
  columns: number
  createdAt: Date
  updatedAt: Date
  locked: boolean
  eventId: string
  rows: number
  codephrase: string
  visible: boolean
  bingoType: "standard" | "progression"
  tiersUnlockRequirement: number
  tiles: TileData[]
}
