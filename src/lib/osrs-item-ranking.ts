import type { OsrsItem } from "@/types/osrs-items"

interface IndexedItem {
  item: OsrsItem
  name: string
  baseName: string
}

// Lower is better. Tiers are judged on the base name (the item without its
// "#variant" suffix) so "Bones" outranks "Bones (Ape Atoll)" and "Big bones".
const EXACT = 0
const PREFIX = 1
const PARTIAL_PREFIX = 2
const WORD_PREFIX = 3
const SUBSTRING = 4
const VARIANT_ONLY = 5

export function indexOsrsItems(items: OsrsItem[]): IndexedItem[] {
  return items.map((item) => ({
    item,
    name: item.name.toLowerCase(),
    baseName: (item.baseName || item.name.split("#")[0] || item.name)
      .toLowerCase()
      .trim(),
  }))
}

function scoreBaseName(baseName: string, query: string, tokens: string[]) {
  if (baseName === query) return EXACT
  if (baseName.startsWith(query)) {
    // "Bones (Ape Atoll)" starts with the whole word, "Bonesack" doesn't.
    return /[a-z0-9]/.test(baseName.charAt(query.length))
      ? PARTIAL_PREFIX
      : PREFIX
  }
  const words = baseName.split(/[\s\-_/()]+/)
  if (tokens.every((t) => words.some((w) => w.startsWith(t)))) {
    return WORD_PREFIX
  }
  if (tokens.every((t) => baseName.includes(t))) return SUBSTRING
  return VARIANT_ONLY
}

/**
 * Filter and rank items for autocomplete. Every whitespace-separated word of
 * the query must appear in the item name (variant included), in any order.
 * Results are ordered exact > prefix > partial prefix > word prefix > substring, then items
 * without a variant, then shorter names, then alphabetically, and only then
 * cut to `limit` so the best match is never dropped.
 */
export function rankOsrsItems(
  indexed: IndexedItem[],
  rawQuery: string,
  limit: number
): OsrsItem[] {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, " ")
  if (!query) return []
  const tokens = query.split(" ")

  const scored: Array<{ entry: IndexedItem; score: number }> = []
  for (const entry of indexed) {
    if (!tokens.every((t) => entry.name.includes(t))) continue
    scored.push({
      entry,
      score: scoreBaseName(entry.baseName, query, tokens),
    })
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    const aVariant = a.entry.item.variant ? 1 : 0
    const bVariant = b.entry.item.variant ? 1 : 0
    if (aVariant !== bVariant) return aVariant - bVariant
    if (a.entry.name.length !== b.entry.name.length) {
      return a.entry.name.length - b.entry.name.length
    }
    return a.entry.name.localeCompare(b.entry.name)
  })

  const capped = limit > 0 ? scored.slice(0, limit) : scored
  return capped.map((s) => s.entry.item)
}
