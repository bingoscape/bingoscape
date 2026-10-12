"use server"

import {
  getAllItems,
  getItemById,
  getItemsById,
  getItemByName,
  getItemVariants,
  parseItemName,
  getItemImageUrl,
} from "osrs-item-data"
import type { OsrsItem } from "@/types/osrs-items"
import { logger } from "@/lib/logger"
import { indexOsrsItems, rankOsrsItems } from "@/lib/osrs-item-ranking"
import {
  createItemResolver,
  type ItemResolver,
  type ResolveEntry,
  type ResolvedItemName,
} from "@/lib/osrs-item-resolve"
import { MAX_GOALS_PER_BATCH, validateTargetValue } from "@/lib/goal-validation"

let itemIndex: ReturnType<typeof indexOsrsItems> | undefined
let itemResolver: ItemResolver | undefined

const MAX_RESOLVE_NAME_LENGTH = 100
/** Readings of one pasted line besides the main one. */
const MAX_RESOLVE_ALTERNATIVES = 3

/**
 * Search for OSRS items by name (autocomplete)
 * Server action for client-side item search
 */
export async function searchOsrsItems(
  query: string,
  limit = 20
): Promise<{ success: boolean; items?: OsrsItem[]; error?: string }> {
  try {
    const trimmed = query?.trim() ?? ""
    if (trimmed.length < 2) {
      return { success: false, error: "Query must be at least 2 characters" }
    }

    itemIndex ??= indexOsrsItems(getAllItems())
    const results = rankOsrsItems(itemIndex, trimmed, limit)

    return { success: true, items: results }
  } catch (error) {
    logger.error({ error }, "Error searching OSRS items:", error)
    return { success: false, error: "Failed to search items" }
  }
}

function validateResolveName(name: unknown): string | null {
  if (typeof name !== "string" || name.trim() === "") {
    return "Item names cannot be empty"
  }
  if (name.trim().length > MAX_RESOLVE_NAME_LENGTH) {
    return `Item names can be at most ${MAX_RESOLVE_NAME_LENGTH} characters`
  }
  return null
}

/**
 * Match item names from a pasted list to items, see `createItemResolver` for
 * the rules. Read-only like `searchOsrsItems`: nothing is created. `results`
 * has one entry per input entry, in the same order.
 */
export async function resolveOsrsItemNames(
  entries: ResolveEntry[]
): Promise<{ success: boolean; results: ResolvedItemName[]; error?: string }> {
  const fail = (error: string) => ({
    success: false,
    results: [] as ResolvedItemName[],
    error,
  })

  try {
    if (!Array.isArray(entries)) return fail("Invalid item list")
    if (entries.length > MAX_GOALS_PER_BATCH) {
      return fail(`You can add at most ${MAX_GOALS_PER_BATCH} items at once`)
    }

    const cleaned: ResolveEntry[] = []
    for (const entry of entries) {
      const readings = [
        entry,
        ...(Array.isArray(entry?.alternatives) ? entry.alternatives : []),
      ]
      if (
        Array.isArray(entry?.alternatives) &&
        entry.alternatives.length > MAX_RESOLVE_ALTERNATIVES
      ) {
        return fail("Invalid item list")
      }
      for (const reading of readings) {
        const nameError = validateResolveName(reading?.name)
        if (nameError) return fail(nameError)
        const quantityError = validateTargetValue(reading.quantity)
        if (quantityError) return fail(`Quantity: ${quantityError}`)
      }
      cleaned.push({
        name: entry.name.trim(),
        quantity: entry.quantity,
        alternatives: entry.alternatives?.map((alt) => ({
          name: alt.name.trim(),
          quantity: alt.quantity,
        })),
      })
    }

    itemIndex ??= indexOsrsItems(getAllItems())
    itemResolver ??= createItemResolver(itemIndex)
    const resolver = itemResolver

    return { success: true, results: cleaned.map((e) => resolver.resolve(e)) }
  } catch (error) {
    logger.error({ error }, "Error resolving OSRS item names:", error)
    return fail("Failed to match the items")
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
    logger.error({ error }, "Error getting OSRS item:", error)
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
    logger.error({ error }, "Error getting OSRS item variants:", error)
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
    logger.error({ error }, "Error getting OSRS item by name:", error)
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
    logger.error({ error }, "Error getting OSRS item variants:", error)
    return { success: false, error: "Failed to get item variants" }
  }
}

/**
 * Parse an item name to extract base name and variant
 */
export async function parseOsrsItemName(itemName: string): Promise<{
  success: boolean
  result?: { baseName: string; variant?: string }
  error?: string
}> {
  try {
    const result = parseItemName(itemName)

    return { success: true, result }
  } catch (error) {
    logger.error({ error }, "Error parsing OSRS item name:", error)
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
    logger.error({ error }, "Error getting OSRS item image URL:", error)
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
    logger.error({ error }, "Error matching item name:", error)
    return { success: false, error: "Failed to match item" }
  }
}
