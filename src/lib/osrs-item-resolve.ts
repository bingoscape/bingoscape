import type { OsrsItem } from "@/types/osrs-items"
import {
  RANK_TIER,
  rankOsrsItemsWithTier,
  type IndexedItem,
} from "@/lib/osrs-item-ranking"

/**
 * Turns names typed or pasted by a person into items of the OSRS item index.
 *
 * For one name, in this order:
 * 1. Exact: the name equals an item's full name, ignoring case, punctuation
 *    and the `#` that separates a variant ("Dragon dagger (p++)" is
 *    "Dragon dagger#(p++)", "Zulrahs fang" is "Zulrah's fang"). One item is
 *    `matched`; several items with that exact name are `ambiguous`.
 * 2. Base name: no item has that full name, but items share it as their base
 *    name, only differing by variant ("Amulet of glory" has 1 to 6 charges).
 *    One item is `matched`, several are `ambiguous`.
 * 3. Ranking: the same search the item picker runs (every word must appear in
 *    the name). A single hit is `matched`. With several hits, the top one is
 *    `matched` only when it is decisive: the query is at least a whole-word
 *    prefix of its name, and the runner-up is two or more ranking tiers
 *    worse. Otherwise the answer is `ambiguous`.
 * 4. No hit is `unmatched`.
 *
 * `ambiguous` lists at most `MAX_CANDIDATES` items.
 *
 * A name can come with alternative readings (see `parseItemList`); every
 * reading is resolved and the one with the most certain result is used
 * (exact beats base-name beats ranking, a unique match beats several, any
 * match beats none). On a tie the earlier reading, the primary one, wins.
 */

export const MAX_CANDIDATES = 5

export type ItemNameStatus = "matched" | "ambiguous" | "unmatched"

export interface ResolveEntry {
  name: string
  quantity: number
  /** Other readings of the same text, tried when they resolve more certainly. */
  alternatives?: Array<{ name: string; quantity: number }>
}

export interface ResolvedItemName {
  /** The reading that was resolved: the entry's name, or one of its alternatives. */
  input: string
  quantity: number
  status: ItemNameStatus
  /** Set when `status` is `matched`. */
  item?: OsrsItem
  /** Set when `status` is `ambiguous`; at most `MAX_CANDIDATES`. */
  candidates?: OsrsItem[]
}

/** Lowercase, no accents, no punctuation except "+", single spaces, "#" as a space. */
export function normalizeItemName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^\p{L}\p{N}+]+/gu, " ")
    .trim()
}

// How sure a result is; the best reading of an entry wins.
const EXACT_ONE = 4
const EXACT_MANY = 3
const RANKED_ONE = 2
const RANKED_MANY = 1
const NONE = 0

interface Reading {
  quality: number
  result: Pick<ResolvedItemName, "status" | "item" | "candidates">
}

function byShortestName(a: OsrsItem, b: OsrsItem): number {
  return a.name.length - b.name.length || a.name.localeCompare(b.name)
}

function group(
  items: OsrsItem[],
  matchedQuality: number,
  manyQuality: number
): Reading {
  const [first] = items
  if (items.length === 1 && first) {
    return {
      quality: matchedQuality,
      result: { status: "matched", item: first },
    }
  }
  return {
    quality: manyQuality,
    result: {
      status: "ambiguous",
      candidates: [...items].sort(byShortestName).slice(0, MAX_CANDIDATES),
    },
  }
}

export interface ItemResolver {
  resolve: (entry: ResolveEntry) => ResolvedItemName
}

/** Builds lookup tables over the (cached) ranking index once; resolving is then cheap. */
export function createItemResolver(indexed: IndexedItem[]): ItemResolver {
  const byFullName = new Map<string, OsrsItem[]>()
  const byBaseName = new Map<string, OsrsItem[]>()
  const add = (map: Map<string, OsrsItem[]>, key: string, item: OsrsItem) => {
    if (!key) return
    const list = map.get(key)
    if (list) list.push(item)
    else map.set(key, [item])
  }
  for (const { item } of indexed) {
    add(byFullName, normalizeItemName(item.name), item)
    add(
      byBaseName,
      normalizeItemName(item.baseName || item.name.split("#")[0] || item.name),
      item
    )
  }

  const readName = (name: string): Reading => {
    const trimmed = name.trim()
    const key = normalizeItemName(trimmed)
    if (!key) return { quality: NONE, result: { status: "unmatched" } }

    const exact = byFullName.get(key)
    if (exact) return group(exact, EXACT_ONE, EXACT_MANY)
    const sameBase = byBaseName.get(key)
    if (sameBase) return group(sameBase, EXACT_ONE, EXACT_MANY)

    // One more than shown, to know whether the list was cut.
    const ranked = rankOsrsItemsWithTier(indexed, trimmed, MAX_CANDIDATES + 1)
    const [top, second] = ranked
    if (!top) return { quality: NONE, result: { status: "unmatched" } }
    const decisive =
      !second || (top.tier <= RANK_TIER.PREFIX && second.tier - top.tier >= 2)
    if (decisive) {
      return {
        quality: RANKED_ONE,
        result: { status: "matched", item: top.item },
      }
    }
    return {
      quality: RANKED_MANY,
      result: {
        status: "ambiguous",
        candidates: ranked.slice(0, MAX_CANDIDATES).map((r) => r.item),
      },
    }
  }

  return {
    resolve(entry) {
      let best = {
        reading: readName(entry.name),
        name: entry.name,
        quantity: entry.quantity,
      }
      for (const { name, quantity } of entry.alternatives ?? []) {
        const reading = readName(name)
        if (reading.quality > best.reading.quality) {
          best = { reading, name, quantity }
        }
      }
      return {
        input: best.name,
        quantity: best.quantity,
        ...best.reading.result,
      }
    },
  }
}
