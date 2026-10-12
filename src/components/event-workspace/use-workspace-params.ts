"use client"

import { useCallback, useMemo, useTransition } from "react"
import { isTileFilter, type TileFilter } from "@/lib/tile-filter"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export const PANEL_TABS = ["tile", "teams", "prize", "info"] as const
export type PanelTab = (typeof PANEL_TABS)[number]

/** Alternative views of the Board area; the Board itself is the default (no param). */
export const WORKSPACE_VIEWS = ["goals"] as const
export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number]

export interface WorkspaceParams {
  /** Selected Board id (`?board=`), null means "first Board". */
  board: string | null
  /** Selected Tile id (`?tile=`). */
  tile: string | null
  /** Active side panel tab (`?panel=`), defaults to "tile". */
  panel: PanelTab
  /** Team being viewed (`?teamId=`), null means the caller's own Team. */
  teamId: string | null
  /** Active Board filter (`?filter=`). */
  filter: TileFilter | null
  /** Alternative view of the Board area (`?view=goals`), null means the Board. */
  view: WorkspaceView | null
}

type ParamReader = { get(name: string): string | null }

export function isWorkspaceView(
  value: string | null | undefined
): value is WorkspaceView {
  return !!value && (WORKSPACE_VIEWS as readonly string[]).includes(value)
}

export function isPanelTab(
  value: string | null | undefined
): value is PanelTab {
  return !!value && (PANEL_TABS as readonly string[]).includes(value)
}

/** Reads the workspace state from the URL search params. Unknown values fall back. */
export function parseWorkspaceParams(search: ParamReader): WorkspaceParams {
  const panel = search.get("panel")
  const filter = search.get("filter")
  const view = search.get("view")
  return {
    board: search.get("board") || null,
    tile: search.get("tile") || null,
    panel: isPanelTab(panel) ? panel : "tile",
    teamId: search.get("teamId") || null,
    filter: isTileFilter(filter) ? filter : null,
    view: isWorkspaceView(view) ? view : null,
  }
}

type Patch = Partial<{
  [K in keyof WorkspaceParams]: WorkspaceParams[K] | null
}>

/**
 * Builds the next URL by applying a patch to the current query string. Null
 * removes a key; the default panel ("tile") is not written. Other query
 * params are preserved.
 */
export function buildWorkspaceUrl(
  pathname: string,
  current: string | URLSearchParams | ParamReaderWithToString,
  patch: Patch
): string {
  const next = new URLSearchParams(
    typeof current === "string" ? current : current.toString()
  )

  const apply = (key: string, value: string | null | undefined) => {
    if (value === undefined) return
    if (value === null || value === "") next.delete(key)
    else next.set(key, value)
  }

  apply("board", patch.board)
  apply("tile", patch.tile)
  apply("teamId", patch.teamId)
  apply("filter", patch.filter)
  apply("view", patch.view)
  if (patch.panel !== undefined) {
    apply("panel", patch.panel === "tile" ? null : patch.panel)
  }

  const query = next.toString()
  return query ? `${pathname}?${query}` : pathname
}

interface ParamReaderWithToString extends ParamReader {
  toString(): string
}

/**
 * Workspace state lives in the URL so it can be shared and bookmarked:
 * `?board=&tile=&panel=tile|teams|prize|info&teamId=`.
 *
 * - `tile` / `panel` use the History API (pushState) so Back deselects the
 *   Tile. Switching between Tiles replaces the entry, so one Back always
 *   clears the selection. Next.js syncs `useSearchParams` with native
 *   pushState/replaceState, so no server round trip happens.
 * - `view` (the goal setup view) also uses pushState, so Back returns to the
 *   Board.
 * - `board` / `teamId` change what the server renders (Board data, "view as"
 *   Team), so they use `router.replace(..., { scroll: false })`.
 */
export function useWorkspaceParams() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  // True while the server re-renders after a Board / Team switch.
  const [isSwitching, startTransition] = useTransition()

  const params = useMemo(
    () => parseWorkspaceParams(searchParams ?? { get: () => null }),
    [searchParams]
  )

  const urlFor = useCallback(
    (patch: Patch) =>
      buildWorkspaceUrl(pathname, searchParams?.toString() ?? "", patch),
    [pathname, searchParams]
  )

  const selectTile = useCallback(
    (tileId: string | null) => {
      if (tileId === params.tile) return
      const url = urlFor(
        tileId === null ? { tile: null } : { tile: tileId, panel: "tile" }
      )
      if (tileId !== null && params.tile === null) {
        window.history.pushState(null, "", url)
      } else {
        window.history.replaceState(null, "", url)
      }
    },
    [params.tile, urlFor]
  )

  const setPanel = useCallback(
    (panel: PanelTab) => {
      if (panel === params.panel) return
      window.history.pushState(null, "", urlFor({ panel }))
    },
    [params.panel, urlFor]
  )

  const setView = useCallback(
    (view: WorkspaceView | null) => {
      if (view === params.view) return
      window.history.pushState(null, "", urlFor({ view }))
    },
    [params.view, urlFor]
  )

  const setFilter = useCallback(
    (filter: TileFilter | null) => {
      if (filter === params.filter) return
      window.history.replaceState(null, "", urlFor({ filter }))
    },
    [params.filter, urlFor]
  )

  const setBoard = useCallback(
    (boardId: string) => {
      // A Tile belongs to one Board: switching Boards clears the selection.
      startTransition(() => {
        router.replace(urlFor({ board: boardId, tile: null, panel: "tile" }), {
          scroll: false,
        })
      })
    },
    [router, urlFor]
  )

  const setTeamId = useCallback(
    (teamId: string | null) => {
      startTransition(() => {
        router.replace(urlFor({ teamId }), { scroll: false })
      })
    },
    [router, urlFor]
  )

  return {
    params,
    selectTile,
    setPanel,
    setFilter,
    setView,
    setBoard,
    setTeamId,
    isSwitching,
  }
}
