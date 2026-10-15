"use server"

import { logger } from "@/lib/logger"
import {
  MAX_QUERY_LENGTH,
  isWikiGame,
  normalizeSearchQuery,
  type WikiImage,
} from "@/lib/wiki-image-search"
import { getServerAuthSession } from "@/server/auth"
import { limitAction } from "@/server/rate-limit"
import { searchWikiImagesCached } from "@/server/wiki-image-search"

export type SearchWikiImagesResult =
  | { success: true; images: WikiImage[] }
  | { success: false; error: string }

/**
 * Searches the wiki for images for the Tile editor's picker (wiki image cache
 * 5/6, epic #226). `game` selects the wiki (`osrs` or `rs3`); the host is
 * fixed on the server and never comes from the caller. Results are wiki URLs:
 * the UI renders them through `toProxyUrl` and stores the wiki URL on pick.
 */
export async function searchWikiImages(
  query: string,
  game: "osrs" | "rs3"
): Promise<SearchWikiImagesResult> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  if (typeof query !== "string" || !isWikiGame(game)) {
    return { success: false, error: "Invalid search" }
  }
  const normalized = normalizeSearchQuery(query)
  if (normalized === "") {
    return { success: false, error: "Enter something to search for" }
  }
  if (normalized.length > MAX_QUERY_LENGTH) {
    return {
      success: false,
      error: `Search for at most ${MAX_QUERY_LENGTH} characters`,
    }
  }

  const limited = await limitAction("wikiImageSearch", session.user.id)
  if (limited) return limited

  try {
    const images = await searchWikiImagesCached(game, normalized)
    return { success: true, images }
  } catch (error) {
    logger.error({ error, game }, "Wiki image search failed")
    return { success: false, error: "The wiki search is unavailable right now" }
  }
}
