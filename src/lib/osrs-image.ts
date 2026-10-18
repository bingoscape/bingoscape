/**
 * Allowlist for OSRS Wiki images (wiki image cache, epic #226).
 *
 * The image cache fetches from a host and a path pattern fixed in this file:
 * the cache key is the wiki path under `/images/`, and the server builds the
 * upstream URL from it, so no user-supplied URL is ever requested. A plain
 * module (no `server-only`) because client components rewrite URLs with
 * `toProxyUrl` too.
 */
import { OSRS_WIKI_HOST } from "@/lib/wiki-hosts"

export { OSRS_WIKI_HOST }

/** Route the cached images are served from. */
export const OSRS_IMAGE_ROUTE = "/api/osrs-image"

/** Path prefix of every wiki image. */
const IMAGES_PREFIX = "/images/"

/** Extensions the cache stores. No SVG: it can carry script. */
const EXTENSION = /\.(?:png|gif|jpe?g|webp)$/i

/**
 * One decoded path segment: letters, digits and the punctuation wiki file
 * names use. No slash, backslash, percent sign (so no double encoding), space
 * or control character, and it cannot start with a dot (no `.` / `..`).
 */
const SEGMENT = /^[\p{L}\p{N}_][\p{L}\p{N}_.,'()!&+~-]*$/u

/** Thumbnail file name: `800px-Giant_frog.png`. */
const THUMB_NAME = /^[1-9]\d{0,3}px-(.+)$/

const MAX_SEGMENT_LENGTH = 255
const MAX_PATH_LENGTH = 512

/** `https://oldschool.runescape.wiki`, with nothing but `/`, `?` or `#` after it. */
const ORIGIN = new RegExp(
  `^https://${OSRS_WIKI_HOST.replaceAll(".", "\\.")}(?=[/?#]|$)`,
  "i"
)

export interface ParsedWikiImage {
  /**
   * The normalised path under `/images/`, for example
   * `thumb/Giant_frog.png/800px-Giant_frog.png`. Segments are percent-encoded
   * in one canonical form, so `Frog_(Zanaris).png` and `Frog_%28Zanaris%29.png`
   * are the same image and the same key. Never contains `?hash`.
   */
  key: string
}

/** Percent-encodes one decoded segment the way the wiki writes its URLs. */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

function isValidFileName(name: string): boolean {
  return (
    name.length <= MAX_SEGMENT_LENGTH &&
    SEGMENT.test(name) &&
    EXTENSION.test(name)
  )
}

/**
 * Validates a path under `/images/` (without the prefix and without a query)
 * and returns its canonical key, or null. Accepted shapes:
 * `<file>` and `thumb/<file>/<width>px-<file>`.
 */
export function normalizeWikiImagePath(path: string): string | null {
  if (path.length === 0 || path.length > MAX_PATH_LENGTH) return null

  const decoded: string[] = []
  for (const raw of path.split("/")) {
    const segment = decodeSegment(raw)
    if (segment === null) return null
    decoded.push(segment)
  }

  const [first, second, third] = decoded
  if (decoded.length === 1) {
    if (first === undefined || !isValidFileName(first)) return null
  } else if (decoded.length === 3) {
    if (first !== "thumb") return null
    if (second === undefined || !isValidFileName(second)) return null
    const thumbFile = third === undefined ? null : THUMB_NAME.exec(third)?.[1]
    if (
      third === undefined ||
      !thumbFile ||
      third.length > MAX_SEGMENT_LENGTH ||
      !isValidFileName(thumbFile)
    ) {
      return null
    }
  } else {
    return null
  }

  return decoded.map(encodeSegment).join("/")
}

/**
 * The cache key of an OSRS Wiki image URL, or null when the URL is not one the
 * cache may fetch: only `https://oldschool.runescape.wiki/images/...` with a
 * strict file name pattern (thumbnails included), no userinfo and no port. A
 * query (`?hash`) or fragment is dropped, so one image has one key.
 */
export function parseWikiImageUrl(url: string): ParsedWikiImage | null {
  const origin = ORIGIN.exec(url)
  if (!origin) return null

  // Work on the raw string, not on `new URL(...).pathname`: the URL parser
  // would silently resolve `..` and `%2e%2e` segments into an allowed path.
  const rest = url.slice(origin[0].length)
  const end = rest.search(/[?#]/)
  const path = end === -1 ? rest : rest.slice(0, end)
  if (!path.startsWith(IMAGES_PREFIX)) return null

  const key = normalizeWikiImagePath(path.slice(IMAGES_PREFIX.length))
  return key === null ? null : { key }
}

/** The route URL that serves a cache key. */
export function keyToProxyUrl(key: string): string {
  return `${OSRS_IMAGE_ROUTE}/${key}`
}

/**
 * Global the root layout sets to `false` (an inline script in the document
 * head) when the server runs with `OSRS_IMAGE_PROXY` off. Browsers cannot read
 * a runtime env var, and `toProxyUrl` has to give the same answer when the
 * server renders a component and when the browser hydrates it.
 */
export const PROXY_DISABLED_GLOBAL = "__OSRS_IMAGE_PROXY__"

/** `OSRS_IMAGE_PROXY` values that switch the rewrite off. Unset means on. */
const OFF_VALUES = new Set(["false", "0", "off", "no"])

/** Whether an `OSRS_IMAGE_PROXY` env value leaves the render rewrite on. */
export function parseImageProxyFlag(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase()
  return value === undefined || !OFF_VALUES.has(value)
}

/**
 * Whether wiki image URLs are rewritten to the cache route. Server code reads
 * `OSRS_IMAGE_PROXY` (default on); browser code reads the global the layout
 * sets from that same variable. Turning the flag off is the rollback of the
 * render rewrite: stored values are wiki URLs either way.
 */
export function isImageProxyEnabled(): boolean {
  if (typeof window !== "undefined") {
    return (window as unknown as Record<string, unknown>)[
      PROXY_DISABLED_GLOBAL
    ] !== false
  }
  return parseImageProxyFlag(process.env.OSRS_IMAGE_PROXY)
}

/**
 * Rewrites an allowlisted OSRS Wiki image URL to its cached route
 * (`/api/osrs-image/<key>`). Anything else, a null or an empty value
 * included, is returned unchanged, and so is everything while
 * `OSRS_IMAGE_PROXY` is off.
 */
export function toProxyUrl(url: string): string
export function toProxyUrl(url: string | null): string | null
export function toProxyUrl(url: string | undefined): string | undefined
export function toProxyUrl(
  url: string | null | undefined
): string | null | undefined
export function toProxyUrl(url: string | null | undefined) {
  if (!url || !isImageProxyEnabled()) return url
  const parsed = parseWikiImageUrl(url)
  return parsed ? keyToProxyUrl(parsed.key) : url
}
