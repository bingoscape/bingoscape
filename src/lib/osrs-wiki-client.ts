/**
 * Shared bits of talking to the OSRS Wiki servers (GE prices, image fetcher).
 *
 * The wiki asks API clients to identify themselves in the User-Agent so it
 * can contact them instead of blocking them. The contact comes from the
 * `OSRS_WIKI_CONTACT_EMAIL` env var (a deploy secret, never committed).
 */

/** Where the wiki image cache stores its files when the env var is unset (dev). */
export const DEFAULT_OSRS_IMAGE_CACHE_DIR = "./.data/osrs-images"

/** User-Agent for every request to a wiki server. */
export function getWikiUserAgent(): string {
  // `||`: docker compose passes an unset secret through as an empty string.
  const contactEmail =
    process.env.OSRS_WIKI_CONTACT_EMAIL?.trim() || "unknown@example.com"
  return `Bingoscape/1.0.0 - ${contactEmail}`
}

/** Request headers every wiki request needs. */
export function wikiRequestHeaders(): Record<string, string> {
  return { "User-Agent": getWikiUserAgent() }
}

/** Directory of the wiki image cache (`OSRS_IMAGE_CACHE_DIR`). */
export function getOsrsImageCacheDir(): string {
  return (
    process.env.OSRS_IMAGE_CACHE_DIR?.trim() || DEFAULT_OSRS_IMAGE_CACHE_DIR
  )
}
