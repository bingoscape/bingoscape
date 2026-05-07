# Plan 04 — Remove type duplication in PublicBingoGrid

## Status: done

## Problem

`public-bingo-grid.tsx` (lines 44–62) declares its own `interface Tile` and
`interface Bingo` rather than importing from `@/app/actions/events`:

```ts
// public-bingo-grid.tsx — locally declared, not imported
interface Tile {
  id: string
  title: string
  description: string | null
  headerImage: string | null
  index: number
  weight: number
  goals?: TileGoal[]
  isHidden?: boolean
}

interface Bingo {
  id: string
  title: string
  description: string | null
  rows: number
  columns: number
  tiles: Tile[]
}
```

These are structural duplicates of the canonical types in
`@/app/actions/events`. They are not imported — they are fresh declarations that
TypeScript treats as independent types. This breaks **locality**: the domain
model has two separate definitions of `Tile`, with no guarantee they stay in
sync.

**Concrete risk:** the canonical `Tile` gained a `tier` field (used by
progression bingo). `PublicBingoGrid`'s local `Tile` does not have it. If code
that calls `PublicBingoGrid` passes a canonical `Tile[]`, TypeScript accepts it
(structural subtyping) and the public grid silently ignores `tier`. If
`PublicBingoGrid` ever needs to use `tier`, a developer has to remember to add
it to the local definition too — there is no compiler reminder.

**Deletion test:** delete the local `interface Tile` and `interface Bingo` and
add `import type { Tile, Bingo } from "@/app/actions/events"`. Either it
compiles cleanly (the types were compatible all along and the duplication was
pure noise) or it surfaces divergence that is already silently wrong.

## Solution

Replace the local declarations with imports from the canonical location.

```ts
// public-bingo-grid.tsx — after change
import type { Tile, Bingo } from "@/app/actions/events"
```

The local `TileGoal` interface (used only inside `PublicBingoGrid`) should be
checked against the canonical `Goal` type in `@/app/actions/events`. If it is a
strict subset, replace it with the canonical type or import `Goal` and use it.
If the public grid truly needs a narrower shape (e.g., it does not care about
`teamProgress`), keep `TileGoal` as a local narrowing type — but name it
distinctly so it is clear it is not the full `Goal`.

## Implementation steps

1. In `public-bingo-grid.tsx`, delete the local `interface Tile` and
   `interface Bingo` declarations (lines 44–62).
2. Add `import type { Tile, Bingo } from "@/app/actions/events"` at the top.
3. Run `npm run build` or `tsc --noEmit` to surface any type errors.
4. For each error: either the local code was already subtly wrong (fix it) or
   the canonical type needs a small adjustment (make it in `events.ts`).
5. Inspect the local `TileGoal` interface against `Goal` from `events.ts`.
   Replace or alias as appropriate.
6. Verify the public event pages still render correctly for both standard and
   progression bingos.

## Files touched

| File | Change |
|---|---|
| `src/components/public-bingo-grid.tsx` | Remove local type declarations, add imports |
| `src/app/actions/events.ts` | Possible minor additions if canonical types are missing fields the public grid needs |

## Benefits

- **Locality:** one `Tile` definition. A change to the domain model (e.g.,
  adding `bingoType` to `Bingo`) is immediately visible in `PublicBingoGrid`
  via a compile error rather than a silent mismatch.
- Low risk, high information value — the deletion test either confirms
  compatibility or reveals hidden drift.
- Establishes the pattern that `@/app/actions/events` is the canonical source
  for domain types, not a place to mirror locally.

## Dependencies

None. This plan is fully independent of Plans 01–03 and can be executed at any
time with minimal risk.
