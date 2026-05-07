# Plan 03 — Single owner for board state

## Status: proposed

## Problem

Board state (rows, columns, tiles) has two owners simultaneously:

| Owner | State | Updated by |
|---|---|---|
| `BingoGridWrapper` | `bingo` (rows, cols, tiles) | `addRowOrColumn`, `deleteRowOrColumn`, `reorderTiles` server actions |
| `BingoGrid` | `tiles` | every tile-level mutation: `updateTile`, `addGoal`, `deleteGoal`, `updateGoalProgress`, `submitImage`, `updateSubmissionStatus`, `deleteSubmission` |

They start equal (`BingoGrid` seeds `tiles` from `bingo.tiles`) but diverge as
mutations happen. The codebase uses two escape hatches to re-synchronise:

1. **`updateKey` in `BingoGridWrapper`** — incremented after every structural
   mutation; passed as part of `BingoGrid`'s `key` prop to force a full
   remount:
   ```tsx
   <BingoGrid key={`${bingo.rows}-${bingo.columns}-${updateKey}`} ... />
   ```
2. **`refreshKey` in `_content.tsx`** — the Refresh button increments this,
   which remounts `BingoGridWrapper` entirely:
   ```tsx
   <BingoGridWrapper key={`bingo-${refreshKey}-${effectiveTeamId}`} ... />
   ```

Two `key=` remount escape hatches at two layers is the pattern that appears
when state ownership is unclear. Each remount throws away all local state and
re-derives from server props — a full reset disguised as a reconcile.

Additionally, `BingoGridWrapper` has an `useEffect` that increments `updateKey`
whenever `bingo` changes:
```ts
useEffect(() => {
  setUpdateKey((prev) => prev + 1)
}, [bingo])
```
This fires on every render where `bingo` is a new object reference, which can
cause unintended remounts.

## Solution

Pick **one owner** for board state. The natural candidate is `BingoGridWrapper`
(already the entry point for board-structure mutations) or a dedicated
`useBoardState` hook that both components read from.

### Proposed shape: `useBoardState` hook

```ts
// src/hooks/use-board-state.ts

function useBoardState(initialBingo: Bingo) {
  const [bingo, setBingo] = useState(initialBingo)

  // Board-structure mutations (currently in BingoGridWrapper)
  const addRow    = useCallback(async () => { ... setBingo(...) }, [bingo.id])
  const addColumn = useCallback(async () => { ... setBingo(...) }, [bingo.id])
  const deleteRow = useCallback(async () => { ... setBingo(...) }, [bingo.id])
  const deleteColumn = useCallback(async () => { ... setBingo(...) }, [bingo.id])
  const reorder   = useCallback(async (tiles: Tile[]) => { ... setBingo(...) }, [bingo.id])

  // Tile-level mutations (currently spread across BingoGrid handlers)
  const updateTileLocally = useCallback((updated: Tile) => {
    setBingo(b => ({ ...b, tiles: b.tiles.map(t => t.id === updated.id ? updated : t) }))
  }, [])

  const removeTile = useCallback((tileId: string) => {
    setBingo(b => ({ ...b, tiles: b.tiles.filter(t => t.id !== tileId) }))
  }, [])

  return { bingo, addRow, addColumn, deleteRow, deleteColumn, reorder, updateTileLocally, removeTile }
}
```

`BingoGridWrapper` calls this hook and passes `bingo` + mutation functions down.
`BingoGrid` receives `tiles` (not a full `bingo`) and calls `updateTileLocally`
/ `removeTile` instead of `setTiles`.

### What gets deleted

- `useState<Tile[]>` in `BingoGrid` (`bingogrid.tsx:86`)
- `updateKey` state and its `useEffect` in `BingoGridWrapper`
- The `useEffect(() => setUpdateKey(...), [bingo])` loop
- The `key={${bingo.rows}-${bingo.columns}-${updateKey}}` remount pattern
- The `refreshKey` in `_content.tsx` (the Refresh button can instead call a
  `reload` function from the hook that re-fetches from the server, or simply
  call `router.refresh()` without a remount)

## Implementation steps

1. Create `src/hooks/use-board-state.ts` with the shape above.
2. Move all `setBingo` calls from `BingoGridWrapper` into the hook.
3. In `BingoGrid`, replace `useState<Tile[]>(bingo.tiles)` with reading `tiles`
   from a prop (the hook's `bingo.tiles`).
4. Replace the `setTiles(...)` calls inside `BingoGrid`'s handlers with calls
   to `updateTileLocally` / `removeTile` passed as props.
5. Remove `updateKey` state and its `useEffect` from `BingoGridWrapper`.
6. Remove `refreshKey` from `_content.tsx`; use `router.refresh()` on the
   Refresh button instead.
7. Verify: add a row, update a tile title, delete a submission — all should
   reflect in the grid without a remount.

## Files touched

| File | Change |
|---|---|
| `src/hooks/use-board-state.ts` | new module |
| `src/components/bingo-grid-wrapper.tsx` | uses hook, removes `updateKey` |
| `src/components/bingogrid.tsx` | removes `useState<Tile[]>`, reads from prop |
| `src/app/events/[id]/bingos/[bingoId]/_content.tsx` | removes `refreshKey` |

## Benefits

- **Locality:** every board mutation (structural or tile-level) is in one
  module. Finding a stale-state bug means looking in `use-board-state.ts`.
- Removes two `key=` remount hacks — React trees are stable, transitions and
  focus are not lost on mutation.
- The hook is the natural test surface: call mutation functions, assert the
  returned `bingo` shape. No DOM rendering needed.

## Dependencies

- Plan 02 Option B overlaps with this plan — if Option B is chosen, the hook
  logic can live in the wrapper directly rather than a separate hook file.
- Plan 01 (TileEditor) is independent but coordinates here: `TileEditor` will
  call `updateTileLocally` instead of directly calling `setTiles` on a
  local copy.
