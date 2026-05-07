# Plan 01 — Extract TileEditor behind a seam

## Status: proposed

## Problem

`bingogrid.tsx` (1090 lines, `/* eslint-disable */`) does two completely
separate jobs with no seam between them:

1. **Render the board** — load tier progress, wire SortableJS, route clicks to
   `BingoGridLayout` or `ProgressionBingoGrid`.
2. **Orchestrate the full tile-editing workflow** — a 3-tab Dialog (Tile
   Details / Goals / Submissions), clipboard paste, image upload, keyboard
   navigation, and all the server-action calls that flow from those interactions.

Job 2 owns roughly 900 of the 1090 lines: 8+ state variables and 15+
handler functions that exist solely to support the open modal. None of this is
behind a seam — the Dialog JSX is inline in the `return` block of `BingoGrid`.

**Deletion test:** remove the tile-editor concern from `BingoGrid`. Complexity
concentrates into one new module (`TileEditor`) rather than scattering. The
remaining `BingoGrid` becomes small: load tier progress, wire SortableJS,
render the layout, open `TileEditor` on tile click.

## Solution

Extract a `TileEditor` module. Proposed location:
`src/components/tile-editor.tsx`

Its interface (to be refined during implementation):

```ts
interface TileEditorProps {
  tile: Tile
  bingo: Bingo
  userRole: EventRole
  teams: Team[]
  gameType: "osrs" | "rs3"
  currentTeamId: string | undefined
  onClose: () => void
  onTileUpdated?: () => void
}
```

`BingoGrid` reduces to:
- State: `tiles`, `selectedTile`, `isEditorOpen`
- Effects: load tier progress, init SortableJS
- Render: layout switch + `{isEditorOpen && <TileEditor ... />}`

Everything else moves into `TileEditor`:
- `editedTile`, `newGoal`, `selectedImage`, `pastedImage`, `isUploadingImage`,
  `selectableUsers`, `selectedUserId`
- All 15+ handler functions (`handleTileUpdate`, `handleAddGoal`,
  `handleDeleteGoal`, `handleProgressUpdate`, `handleImageChange`,
  `handleImageSubmit`, `handlePaste`, `handleDeleteSubmission`,
  `handleTeamTileSubmissionStatusUpdate`, `handleSubmissionStatusUpdate`,
  `handleDeleteTile`, `refreshSubmissions`)
- The `<Dialog>` JSX with its three `<TabsContent>` blocks
- Keyboard navigation `useEffect`
- Clipboard paste `useEffect`
- The `hasSufficientRights()` helper (rename to `canManage()` for clarity)
- The `useSession` call (only needed for `reviewedBy` assignment)

## Implementation steps

1. Create `src/components/tile-editor.tsx` as a `"use client"` module.
2. Move all state, effects, and handlers listed above into it verbatim.
3. Replace the inline `<Dialog>` in `bingogrid.tsx` with
   `{selectedTile && isEditorOpen && <TileEditor ... onClose={() => setIsEditorOpen(false)} />}`.
4. Remove the `/* eslint-disable */` directive from `bingogrid.tsx` (it was
   masking lint errors in the modal code; fix any that surface).
5. Verify the existing UI behaviour is unchanged by manual smoke-test
   (open tile, edit, add goal, submit image, approve submission).
6. Delete dead imports from `bingogrid.tsx` (`useSession`, `getSubmissions`,
   `submitImage`, `updateTeamTileSubmissionStatus`, `deleteSubmission`,
   `updateSubmissionStatus`, `getSelectableUsersForSubmission`,
   `TileDetailsTab`, `GoalsTab`, `SubmissionsTab`, etc.).

## Files touched

| File | Change |
|---|---|
| `src/components/bingogrid.tsx` | ~900 lines removed, Dialog replaced by `<TileEditor>` |
| `src/components/tile-editor.tsx` | new module (~900 lines) |

## Benefits

- **Locality:** all tile-editing bugs (upload races, goal deletion, submission
  status cascades) live in one module with a clear input/output surface.
- **Leverage:** testing tile-editing means instantiating `TileEditor` with a
  tile and a bingo — not rendering a full interactive grid and simulating a
  click.
- `bingogrid.tsx` drops from ~1090 to ~150 lines and can have its eslint
  suppression removed.

## What this does NOT change

- The three tab-content components (`TileDetailsTab`, `GoalsTab`,
  `SubmissionsTab`) are not touched — they stay where they are and are simply
  re-imported from `TileEditor` instead of `BingoGrid`.
- The server actions in `@/app/actions/bingo` are not touched.
- `BingoGridWrapper` and the page layer are not touched.
