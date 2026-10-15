/**
 * The wiki image search of the Tile editor, on the server (wiki image cache
 * 5/6, epic #226).
 *
 * A search is at most two requests to the wiki: one `list=search`, then one
 * batched `titles=A|B|C` info call for all results (the browser used to send
 * one request per result). Both carry the shared User-Agent. Answers are kept
 * in memory for a short time per game and normalised query, so a repeated
 * search does not reach the wiki at all; concurrent identical searches share
 * one request. Failures are not cached.
 *
 * Not a "use server" module: nothing here is callable from the client.
 */
import { wikiRequestHeaders } from "@/lib/osrs-wiki-client"
import {
  buildImageInfoUrl,
  buildSearchUrl,
  mapImageInfo,
  parseSearchTitles,
  searchCacheKey,
  type WikiGame,
  type WikiImage,
} from "@/lib/wiki-image-search"

/** How long a search answer is reused. */
export const SEARCH_CACHE_TTL_MS = 10 * 60_000
/** Most answers kept; the oldest is dropped first. */
export const SEARCH_CACHE_MAX_ENTRIES = 200
export const SEARCH_TIMEOUT_MS = 5_000

const answers = new Map<string, { images: WikiImage[]; expiresAt: number }>()
const inFlight = new Map<string, Promise<WikiImage[]>>()

/** Forgets every cached answer (tests). */
export function resetWikiSearchCache(): void {
  answers.clear()
  inFlight.clear()
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: wikiRequestHeaders(),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`The wiki answered with status ${response.status}`)
  }
  return response.json()
}

async function searchUpstream(
  game: WikiGame,
  query: string
): Promise<WikiImage[]> {
  const titles = parseSearchTitles(await getJson(buildSearchUrl(game, query)))
  if (titles.length === 0) return []
  return mapImageInfo(
    game,
    titles,
    await getJson(buildImageInfoUrl(game, titles))
  )
}

/**
 * Searches the wiki of `game` for images. `query` must already be validated
 * and normalised (`normalizeSearchQuery`). Throws when the wiki cannot be
 * reached or answers badly.
 */
export async function searchWikiImagesCached(
  game: WikiGame,
  query: string,
  now: number = Date.now()
): Promise<WikiImage[]> {
  const key = searchCacheKey(game, query)

  const cached = answers.get(key)
  if (cached) {
    if (cached.expiresAt > now) return cached.images
    answers.delete(key)
  }

  const pending = inFlight.get(key)
  if (pending) return pending

  const request = searchUpstream(game, query)
    .then((images) => {
      answers.set(key, { images, expiresAt: now + SEARCH_CACHE_TTL_MS })
      while (answers.size > SEARCH_CACHE_MAX_ENTRIES) {
        const oldest = answers.keys().next().value
        if (oldest === undefined) break
        answers.delete(oldest)
      }
      return images
    })
    .finally(() => {
      inFlight.delete(key)
    })
  inFlight.set(key, request)
  return request
}
