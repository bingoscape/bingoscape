import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { toProxyUrl } from "@/lib/osrs-image"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The URL to put in an `<img>` / `next/image` `src`. Stored values are never
 * changed: uploads get their `/api` prefix and OSRS Wiki images are served from
 * our own cache (`toProxyUrl`, wiki image cache epic #226).
 */
export function getOptimizedImageUrl(url?: string | null): string {
  if (!url) return "/placeholder.svg"
  if (url.startsWith("/uploads")) {
    return `/api${url}`
  }
  return toProxyUrl(url)
}
