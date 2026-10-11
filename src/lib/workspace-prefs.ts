/**
 * Per-device layout preferences for the Event workspace's split view. They are
 * stored in a cookie (not localStorage) so the server can render the saved
 * width on the first paint.
 */
export interface WorkspacePrefs {
  /** Side panel width in px; `null` uses the responsive default. */
  sideWidth: number | null
  /** Side panel shrunk to an icon rail. */
  collapsed: boolean
}

export const WORKSPACE_PREFS_COOKIE = "bs-workspace"

export const DEFAULT_WORKSPACE_PREFS: WorkspacePrefs = {
  sideWidth: null,
  collapsed: false,
}

export const MIN_SIDE_WIDTH = 320
/** Largest share of the workspace the side panel may take. */
export const MAX_SIDE_FRACTION = 0.6
export const COLLAPSED_SIDE_WIDTH = 56

const DEFAULT_SIDE_WIDTH_CSS = "clamp(360px, 30vw, 480px)"
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/** Clamp a side panel width to what fits a workspace of `containerWidth`. */
export function clampSideWidth(width: number, containerWidth: number): number {
  const max = Math.max(MIN_SIDE_WIDTH, containerWidth * MAX_SIDE_FRACTION)
  return Math.round(Math.min(max, Math.max(MIN_SIDE_WIDTH, width)))
}

export function parseWorkspacePrefs(raw: string | undefined): WorkspacePrefs {
  if (!raw) return DEFAULT_WORKSPACE_PREFS
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw))
    if (typeof value !== "object" || value === null) {
      return DEFAULT_WORKSPACE_PREFS
    }
    const { sideWidth, collapsed } = value as Record<string, unknown>
    return {
      sideWidth:
        typeof sideWidth === "number" &&
        Number.isFinite(sideWidth) &&
        sideWidth >= MIN_SIDE_WIDTH
          ? Math.round(sideWidth)
          : null,
      collapsed: collapsed === true,
    }
  } catch {
    return DEFAULT_WORKSPACE_PREFS
  }
}

export function serializeWorkspacePrefsCookie(prefs: WorkspacePrefs): string {
  const value = encodeURIComponent(JSON.stringify(prefs))
  return `${WORKSPACE_PREFS_COOKIE}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
}

/** CSS width of the side panel column. */
export function sideWidthCss(prefs: WorkspacePrefs): string {
  if (prefs.collapsed) return `${COLLAPSED_SIDE_WIDTH}px`
  if (prefs.sideWidth === null) return DEFAULT_SIDE_WIDTH_CSS
  // Re-clamped in CSS so a saved width still fits a smaller window.
  return `min(${MAX_SIDE_FRACTION * 100}%, max(${MIN_SIDE_WIDTH}px, ${prefs.sideWidth}px))`
}
