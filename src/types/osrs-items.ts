/**
 * Type definitions for OSRS item goals integration
 * Re-exports from osrs-item-data package with additional goal-specific types
 */

import type {
  OsrsItem,
  ImageUrlOptions,
  ItemFilter,
} from "osrs-item-data"

// Re-export core types from osrs-item-data
export type { OsrsItem, ImageUrlOptions, ItemFilter }

/**
 * Item goal data stored in database
 */
export interface ItemGoalData {
  id: string
  goalId: string
  itemId: number
  baseName: string
  exactVariant: string | null
  imageUrl: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Goal with item data included (for display)
 */
export interface GoalWithItem {
  id: string
  tileId: string
  parentGroupId: string | null
  description: string
  targetValue: number
  goalType: "generic" | "item"
  orderIndex: number
  createdAt: Date
  updatedAt: Date
  itemGoal?: ItemGoalData
}

/**
 * Request to create an item goal
 */
export interface CreateItemGoalRequest {
  tileId: string
  itemId: number
  itemName: string
  baseName: string
  targetValue: number
  parentGroupId?: string | null
}

/**
 * RuneLite API item possession data
 */
export interface RuneLiteItemData {
  itemId: number
  itemName: string
  quantity: number
  location: "bank" | "inventory"
}

/**
 * RuneLite API request body for item checking
 */
export interface RuneLiteItemCheckRequest {
  apiKey: string
  teamId: string
  items: RuneLiteItemData[]
}

/**
 * Matched goal from RuneLite item check
 */
export interface MatchedItemGoal {
  goalId: string
  itemName: string
  baseName: string
  previousProgress: number
  newProgress: number
  completed: boolean
  tileId: string
}

/**
 * RuneLite API response for item checking
 */
export interface RuneLiteItemCheckResponse {
  success: boolean
  matchedGoals: MatchedItemGoal[]
  tilesCompleted: string[]
  error?: string
}

/**
 * Item search result with additional metadata
 */
export interface OsrsItemSearchResult extends OsrsItem {
  // Add any additional metadata needed for search results
  matchScore?: number
}
