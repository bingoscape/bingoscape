/**
 * Pure parts of the wiki image search of the Tile editor (wiki image cache
 * 5/6, epic #226): input validation, the `api.php` URLs and the response
 * mapping. The server side (cache, rate limit, fetch) is in
 * `@/server/wiki-image-search`; nothing here touches the network.
 *
 * The wiki host is chosen from the validated `WikiGame` here, never taken from
 * the caller, so a search can only ever reach the two known wikis.
 */
import { OSRS_WIKI_HOST, RS3_WIKI_HOST } from "@/lib/wiki-hosts"

/** The games the Tile editor can search images for (`Event.gameType`). */
export const WIKI_GAMES = ["osrs", "rs3"] as const
export type WikiGame = (typeof WIKI_GAMES)[number]

const WIKI_HOST_BY_GAME: Record<WikiGame, string> = {
  osrs: OSRS_WIKI_HOST,
  rs3: RS3_WIKI_HOST,
}

export function isWikiGame(value: unknown): value is WikiGame {
  return (
    typeof value === "string" && (WIKI_GAMES as readonly string[]).includes(value)
  )
}

/** The host of a game's wiki. */
export function wikiHostFor(game: WikiGame): string {
  return WIKI_HOST_BY_GAME[game]
}

/** One search result: wiki URLs, the UI renders them through `toProxyUrl`. */
export interface WikiImage {
  title: string
  url: string
  thumbnail: string
}

export const MAX_QUERY_LENGTH = 100
/** Search results per query; the API allows up to 50 titles per info call. */
export const MAX_RESULTS = 20
/** Width of the picker thumbnails. */
export const THUMB_WIDTH = 100

/** Trims and collapses whitespace, so equal searches share one cache entry. */
export function normalizeSearchQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim()
}

/** The cache key of a search: the game and the lower-cased normalised query. */
export function searchCacheKey(game: WikiGame, normalizedQuery: string): string {
  return `${game}:${normalizedQuery.toLowerCase()}`
}

function apiUrl(game: WikiGame, params: Record<string, string>): string {
  const url = new URL(`https://${wikiHostFor(game)}/api.php`)
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value)
  }
  return url.toString()
}

/** First request: file titles matching the query (namespace 6 is `File:`). */
export function buildSearchUrl(game: WikiGame, query: string): string {
  return apiUrl(game, {
    action: "query",
    list: "search",
    srsearch: query,
    srnamespace: "6",
    srlimit: String(MAX_RESULTS),
    format: "json",
    formatversion: "2",
  })
}

/** Second request: the URL and thumbnail of every title, in one call. */
export function buildImageInfoUrl(game: WikiGame, titles: string[]): string {
  return apiUrl(game, {
    action: "query",
    titles: titles.join("|"),
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: String(THUMB_WIDTH),
    format: "json",
    formatversion: "2",
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** Throws when the wiki answered 200 with an API error object. */
function assertNoApiError(data: unknown): asserts data is Record<string, unknown> {
  if (!isRecord(data)) throw new Error("Unexpected wiki response")
  if (data.error) throw new Error("The wiki API returned an error")
}

/** The (canonical, `File:`-prefixed) titles of a search response, in rank order. */
export function parseSearchTitles(data: unknown): string[] {
  assertNoApiError(data)
  const search = isRecord(data.query) ? data.query.search : undefined
  if (!Array.isArray(search)) return []
  const titles: string[] = []
  for (const hit of search) {
    if (isRecord(hit) && typeof hit.title === "string" && hit.title) {
      titles.push(hit.title)
    }
  }
  return titles.slice(0, MAX_RESULTS)
}

/** Whether a URL from the wiki response is https on the game's own wiki host. */
function isOnWikiHost(value: unknown, host: string): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === host
  } catch {
    return false
  }
}

/**
 * Maps the batched info response to the search results, keeping the search
 * order. A title without image info (deleted, or not a file) and a URL that is
 * not on the wiki host are dropped.
 */
export function mapImageInfo(
  game: WikiGame,
  titles: string[],
  data: unknown
): WikiImage[] {
  assertNoApiError(data)
  const host = wikiHostFor(game)
  const pages = isRecord(data.query) ? data.query.pages : undefined
  const byTitle = new Map<string, { url: string; thumbnail: string }>()
  if (Array.isArray(pages)) {
    for (const page of pages) {
      if (!isRecord(page) || typeof page.title !== "string") continue
      const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] : undefined
      if (!isRecord(info) || !isOnWikiHost(info.url, host)) continue
      const thumbnail = isOnWikiHost(info.thumburl, host) ? info.thumburl : ""
      byTitle.set(page.title, { url: info.url, thumbnail })
    }
  }

  const images: WikiImage[] = []
  for (const title of titles) {
    const found = byTitle.get(title)
    if (found) {
      images.push({
        title: title.replace(/^File:/, ""),
        url: found.url,
        thumbnail: found.thumbnail,
      })
    }
  }
  return images
}
