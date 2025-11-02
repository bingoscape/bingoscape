"use server"

import {
  searchItemsByName,
  getItemById,
  getItemsById,
  getItemByName,
  getItemVariants,
  parseItemName,
  getItemImageUrl,
} from "osrs-item-data"
import type { OsrsItem } from "@/types/osrs-items"

/**
 * Search for OSRS items by name (autocomplete)
 * Server action for client-side item search
 */
export async function searchOsrsItems(
  query: string,
  limit = 20
): Promise<{ success: boolean; items?: OsrsItem[]; error?: string }> {
  try {
    if (!query || query.length < 2) {
      return { success: false, error: "Query must be at least 2 characters" }
    }

    const results = searchItemsByName(query, limit)

    return { success: true, items: results }
  } catch (error) {
    console.error("Error searching OSRS items:", error)
    return { success: false, error: "Failed to search items" }
  }
}

/**
 * Get a single OSRS item by ID
 */
export async function getOsrsItemById(
  itemId: number
): Promise<{ success: boolean; item?: OsrsItem; error?: string }> {
  try {
    const item = getItemById(itemId)

    if (!item) {
      return { success: false, error: "Item not found" }
    }

    return { success: true, item }
  } catch (error) {
    console.error("Error getting OSRS item:", error)
    return { success: false, error: "Failed to get item" }
  }
}

/**
 * Get all variants of an item by ID
 */
export async function getOsrsItemVariantsById(
  itemId: number
): Promise<{ success: boolean; items?: OsrsItem[]; error?: string }> {
  try {
    const items = getItemsById(itemId)

    return { success: true, items }
  } catch (error) {
    console.error("Error getting OSRS item variants:", error)
    return { success: false, error: "Failed to get item variants" }
  }
}

/**
 * Get an OSRS item by exact name
 */
export async function getOsrsItemByName(
  name: string
): Promise<{ success: boolean; item?: OsrsItem; error?: string }> {
  try {
    const item = getItemByName(name)

    if (!item) {
      return { success: false, error: "Item not found" }
    }

    return { success: true, item }
  } catch (error) {
    console.error("Error getting OSRS item by name:", error)
    return { success: false, error: "Failed to get item" }
  }
}

/**
 * Get all variants of an item by base name
 */
export async function getOsrsItemVariantsByBaseName(
  baseName: string
): Promise<{ success: boolean; items?: OsrsItem[]; error?: string }> {
  try {
    const items = getItemVariants(baseName)

    return { success: true, items }
  } catch (error) {
    console.error("Error getting OSRS item variants:", error)
    return { success: false, error: "Failed to get item variants" }
  }
}

/**
 * Parse an item name to extract base name and variant
 */
export async function parseOsrsItemName(
  itemName: string
): Promise<{ success: boolean; result?: { baseName: string; variant?: string }; error?: string }> {
  try {
    const result = parseItemName(itemName)

    return { success: true, result }
  } catch (error) {
    console.error("Error parsing OSRS item name:", error)
    return { success: false, error: "Failed to parse item name" }
  }
}

/**
 * Get image URL for an OSRS item
 */
export async function getOsrsItemImageUrl(
  itemName: string,
  options?: { width?: number; useThumb?: boolean; includeVariant?: boolean }
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    const imageUrl = getItemImageUrl(itemName, options)

    return { success: true, imageUrl }
  } catch (error) {
    console.error("Error getting OSRS item image URL:", error)
    return { success: false, error: "Failed to get image URL" }
  }
}

/**
 * Check if an item name matches a base name (variant-agnostic)
 * Used for submission validation
 */
export async function doesItemMatchBaseName(
  itemName: string,
  baseName: string
): Promise<{ success: boolean; matches?: boolean; error?: string }> {
  try {
    const parsed = parseItemName(itemName)
    const matches = parsed.baseName.toLowerCase() === baseName.toLowerCase()

    return { success: true, matches }
  } catch (error) {
    console.error("Error matching item name:", error)
    return { success: false, error: "Failed to match item" }
  }
}
