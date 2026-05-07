# Plan 02 — Collapse BingoGridWrapper or give it a real job

## Status: proposed

## Problem

`BingoGridWrapper` has a 5-prop interface. `BingoGrid` has an 8-prop interface.
All 5 of the wrapper's props flow straight through to `BingoGrid` unchanged.
The wrapper adds only `isLayoutLocked`, `highlightedTiles`, and wires up the
layout-mutation server actions (add/delete row/col, reorder). That is a thin
layer on top of a complex one — the interface is nearly as wide as the thing it
wraps, which means callers get little leverage from the abstraction.

The leak is visible in two places:

1. **Two callers, different paths:**
   - `_content.tsx` → `BingoGridWrapper` (managed path with layout controls)
   - `event-bingos-client.tsx` → `BingoGrid` directly with `isLayoutLocked={true}`

   A caller has to know which component to reach for and why. That is a sign the
   seam is not clean.

2. **`handleToggleLock` has a `// TODO`:**

   ```ts
   // TODO: Implement the actual API call to toggle the lock state
   setIsLocked((prevIsLocked) => !prevIsLocked)
   ```

   Lock state is purely client-local. A page refresh silently resets it to
   `true`. The seam for persisting lock state does not exist on the server yet.
   The wrapper is hiding this bug without solving it.

## Options

Two valid directions — pick one before implementing.

### Option A — Collapse: merge the wrapper into BingoGrid

Remove `BingoGridWrapper`. Move its layout-editing controls and `isLayoutLocked`
state into `BingoGrid`. Add a single `allowLayoutEditing?: boolean` prop to
`BingoGrid` (defaulting to `false`) that controls whether the Lock/Unlock and
row/column buttons are rendered.

Callers:
- `_content.tsx` → `<BingoGrid allowLayoutEditing={isAdminOrManagement} ...>`
- `event-bingos-client.tsx` → `<BingoGrid ...>` (no change needed — default is locked)

**When to prefer this:** if lock state is intentionally never persisted to the
server (local-session layout mode only).

### Option B — Deepen: make the wrapper own all board state

Keep the wrapper but give it a real job: be the single owner of board state
(rows, columns, tiles). `BingoGrid` becomes a stateless layout renderer that
receives `tiles` + dimensions as props and emits events upward. This solves
Plan 03 at the same time.

The wrapper's interface becomes meaningfully smaller than `BingoGrid`'s because
callers no longer need to pass `bingo` with pre-loaded tiles — only the
`bingoId` is needed; the wrapper fetches/manages the rest.

**When to prefer this:** if board state will grow (e.g., optimistic updates,
real-time sync) and a single owner is worth the up-front work.

## Recommended option

**Option A** if the lock toggle is being removed or confirmed as session-only.
**Option B** if Plan 03 (single board state owner) is also being executed —
the two plans combine naturally.

## Implementation steps (Option A)

1. Move `isLayoutLocked` state, `highlightedTiles` state, and the
   Lock/Unlock + row/column button JSX from `bingo-grid-wrapper.tsx` into
   `bingogrid.tsx`.
2. Add `allowLayoutEditing?: boolean` prop to `BingoGridProps` (default `false`).
   Guard the management controls block with this flag.
3. Update `_content.tsx` to import and use `BingoGrid` directly (remove
   `BingoGridWrapper` import).
4. Update `event-bingos-client.tsx` — already uses `BingoGrid` directly, no
   change needed.
5. Delete `src/components/bingo-grid-wrapper.tsx`.
6. Address the lock TODO explicitly: either remove the button and accept
   session-only lock, or implement the server action before this plan ships.

## Implementation steps (Option B)

1. `BingoGridWrapper` gains a `bingoId` prop (or keeps `bingo` as initial
   data) and becomes the sole author of board state updates.
2. All board-structure mutations (`addRowOrColumn`, `deleteRowOrColumn`,
   `reorderTiles`) stay in the wrapper — already there.
3. Tile-level mutations that currently update `tiles` inside `BingoGrid`
   propagate up via an `onBoardChanged` callback (or are moved to the wrapper
   entirely as part of Plan 01).
4. `BingoGrid` removes its `useState<Tile[]>` and reads tiles from props.
5. The `updateKey` remount hack in the wrapper is deleted.

## Files touched (Option A)

| File | Change |
|---|---|
| `src/components/bingogrid.tsx` | Add `allowLayoutEditing` prop, absorb lock + row/col controls |
| `src/components/bingo-grid-wrapper.tsx` | Deleted |
| `src/app/events/[id]/bingos/[bingoId]/_content.tsx` | Import `BingoGrid` directly |

## Files touched (Option B)

| File | Change |
|---|---|
| `src/components/bingo-grid-wrapper.tsx` | Deepened: owns all board state |
| `src/components/bingogrid.tsx` | Removes `useState<Tile[]>`, reads from props |
| (overlap with Plan 03) | |

## Benefits

- **Leverage:** callers use one component with one clear contract.
- Eliminates the "which of the two grid components do I use?" decision.
- Forces the lock-toggle TODO to be resolved rather than hidden.
- **Locality:** layout-editing logic lives in exactly one place.

## Dependencies

- Plan 03 (board state single owner) overlaps with Option B — execute together
  if choosing Option B.
- Plan 01 (TileEditor seam) is independent and can be done in any order.
