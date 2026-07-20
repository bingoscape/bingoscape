import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getOptimizedImageUrl(url?: string | null): string {
  if (!url) return "/placeholder.svg"
  if (url.startsWith("/uploads")) {
    return `/api${url}`
  }
  return url
}
