import { createHash } from "crypto"

/** A strong ETag (quoted) for the given serialisable value. */
export function computeEtag(value: unknown): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 32)
  return `"${hash}"`
}

/**
 * Whether an `If-None-Match` header matches the ETag. Handles lists, the weak
 * prefix and `*` (weak comparison, as RFC 9110 requires for If-None-Match).
 */
export function ifNoneMatchHits(header: string | null, etag: string): boolean {
  if (!header) return false
  const strip = (tag: string) => tag.trim().replace(/^W\//, "")
  const wanted = strip(etag)
  return header
    .split(",")
    .map(strip)
    .some((tag) => tag === "*" || tag === wanted)
}
