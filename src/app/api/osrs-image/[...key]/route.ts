import { Readable } from "stream"
import fs from "fs/promises"
import { type NextRequest, NextResponse } from "next/server"

import { ifNoneMatchHits } from "@/lib/etag"
import { logger } from "@/lib/logger"
import { OSRS_IMAGE_ROUTE, normalizeWikiImagePath } from "@/lib/osrs-image"
import {
  clientIpFromHeaders,
  checkRateLimit,
  rateLimitedResponse,
} from "@/server/rate-limit"
import { getCachedImage, type CachedImage } from "@/server/osrs-image/cache"
import {
  PLACEHOLDER_CONTENT_TYPE,
  PLACEHOLDER_PNG,
} from "@/server/osrs-image/placeholder"

/**
 * Read-through cache route for OSRS Wiki images (wiki image cache 2/6, epic
 * #226): `GET /api/osrs-image/<key>`, the key being the path under the wiki's
 * `/images/` (`@/lib/osrs-image`). Public: the images are the wiki's public
 * ones and the key is validated against a fixed allowlist.
 *
 * Standalone output only serves `public/`, so the route reads the file from
 * the cache volume itself. `src/proxy.ts` does not match paths ending in an
 * image extension, so these requests skip it (no sign-in redirect, no CSP
 * header), and `/api` is not a protected prefix anyway.
 */

const IMAGE_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800"
/** A placeholder is only a stand-in: browsers must ask again soon. */
const PLACEHOLDER_CACHE_CONTROL = "public, max-age=300"

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "Cache-Control": "public, max-age=300" },
  })
}

function placeholder() {
  return new NextResponse(new Uint8Array(PLACEHOLDER_PNG), {
    headers: {
      "Content-Type": PLACEHOLDER_CONTENT_TYPE,
      "Content-Length": String(PLACEHOLDER_PNG.length),
      "Cache-Control": PLACEHOLDER_CACHE_CONTROL,
    },
  })
}

async function serveImage(request: NextRequest, image: CachedImage) {
  const headers = {
    ETag: image.etag,
    "Cache-Control": IMAGE_CACHE_CONTROL,
  }
  if (ifNoneMatchHits(request.headers.get("if-none-match"), image.etag)) {
    return new NextResponse(null, { status: 304, headers })
  }

  let handle: fs.FileHandle
  try {
    handle = await fs.open(image.filePath, "r")
  } catch {
    // Removed between the cache lookup and now; the next request refetches.
    return placeholder()
  }
  // The stream closes the handle when it ends or is cancelled.
  const stream = handle.createReadStream()
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      ...headers,
      "Content-Type": image.contentType,
      "Content-Length": String(image.bytes),
    },
  })
}

export async function GET(request: NextRequest) {
  // Work on the raw path, like the uploads route; the key parser decodes it.
  const raw = request.nextUrl.pathname.slice(OSRS_IMAGE_ROUTE.length + 1)
  const key = normalizeWikiImagePath(raw)
  if (key === null) return notFound()

  try {
    const result = await getCachedImage(key, {
      admitMiss: () =>
        checkRateLimit(
          "osrsImageMiss",
          `ip:${clientIpFromHeaders((name) => request.headers.get(name))}`
        ),
    })

    switch (result.kind) {
      case "hit":
        return await serveImage(request, result.image)
      case "unavailable":
        return placeholder()
      case "throttled":
        return rateLimitedResponse({
          allowed: false,
          retryAfterSeconds: result.retryAfterSeconds,
        })
    }
  } catch (error) {
    logger.error({ error, key }, "OSRS image route failed")
    return new NextResponse("Image unavailable", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    })
  }
}
