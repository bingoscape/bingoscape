/**
 * Wiki images for server-side renderers that cannot use a relative URL
 * (wiki image cache 3/6, epic #226). Satori (`ImageResponse`, used by the Open
 * Graph image) fetches `<img src>` itself and needs an absolute URL; instead of
 * building one from the app's origin (and calling ourselves over HTTP) this
 * reads the cached file and inlines it as a `data:` URI.
 */
import fs from "fs/promises"

import { logger } from "@/lib/logger"
import { isImageProxyEnabled, parseWikiImageUrl } from "@/lib/osrs-image"
import { getCachedImage } from "@/server/osrs-image/cache"

/**
 * The `src` to render for a stored image URL:
 * - an OSRS Wiki image becomes a `data:` URI built from the cache (fetched
 *   from the wiki the first time only);
 * - `null` when the cache cannot provide it right now (the wiki has no such
 *   image, a retry is pending, the file is unreadable): the caller renders
 *   without the image instead of asking the wiki again;
 * - any other URL, or every URL while `OSRS_IMAGE_PROXY` is off, is returned
 *   unchanged.
 */
export async function getInlineImageSrc(
  url: string | null | undefined
): Promise<string | null> {
  if (!url) return null
  if (!isImageProxyEnabled()) return url
  const parsed = parseWikiImageUrl(url)
  if (!parsed) return url

  try {
    const result = await getCachedImage(parsed.key)
    if (result.kind !== "hit") return null
    const data = await fs.readFile(result.image.filePath)
    return `data:${result.image.contentType};base64,${data.toString("base64")}`
  } catch (error) {
    logger.error({ error, key: parsed.key }, "Inlining a cached OSRS image failed")
    return null
  }
}
