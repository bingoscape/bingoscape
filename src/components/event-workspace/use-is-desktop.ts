"use client"

import { useSyncExternalStore } from "react"

/** Matches Tailwind's `lg` breakpoint, where the side panel replaces the drawer. */
export const DESKTOP_QUERY = "(min-width: 1024px)"

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/**
 * True at >= 1024px. The server snapshot is `true` (desktop), so the layout
 * that CSS media queries already chose is not contradicted before hydration.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true
  )
}
