# Bingoscape OSRS theme

Original, CSS-only interface theme inspired by Old School RuneScape. No Jagex artwork, sprites, or font files are used.

## Themes

- **Stone (dark, default)**: `next-themes` class `dark`. Stone/leather browns with parchment text.
- **Parchment (light)**: `:root`. Aged parchment surfaces, dark brown text.
- `system` is supported through the mode toggle (Light / Dark / System).
- `.parchment` and `.osrs-tooltip` are scoped light surfaces: they re-define the tokens for their subtree and disable `dark:` variants inside, so content stays readable on a pale surface even in the dark theme.

## Palette

Fixed colours (utilities `bg-osrs-*`, `text-osrs-*`):

| Token                  | Value                                              |
| ---------------------- | -------------------------------------------------- |
| `osrs-stone-950..500`  | `#1c170f #2b2418 #3e3529 #4b4132 #5a4f3f #6d6350`  |
| `osrs-parchment`       | `#d8c9a0`                                          |
| `osrs-gold`            | `#ff981f` (titles, button text)                    |
| `osrs-yellow`          | `#ffff00` (hover, item quantity)                   |
| `osrs-green` / `red` / `cyan` | `#00ff00` / `#ff0000` / `#00ffff`           |

Semantic tokens (HSL triplets in `globals.css`, utilities `bg-*`/`text-*`):
`background foreground card popover primary secondary muted accent destructive border input field ring`,
plus status tokens `success warning info pending` (each with `-foreground`) and `danger` (red that is safe as text).
`field` is the recessed input/slot background. Prefer these over raw Tailwind colours.

Status meaning: `success` = Tile completed / approved, `warning` = changes requested, `pending` = Submission awaiting review, `info` = neutral notices, `destructive`/`danger` = errors and deletions.

The raw Tailwind palette families (`gray`, `green`, `blue`, ...) are remapped in `@theme` to warm stone/leather/OSRS hues so legacy utilities stay on-theme.

Contrast (WCAG AA, 4.5:1 for text) was checked for foreground/card/background/muted/primary/status pairs in both themes with a one-off script (re-check when changing tokens). Gold `#ff981f` on the stone button face `#4b4132` is 4.8:1, yellow hover on `#5a4f3f` is 7.4:1.

## Type

- Display: **RuneScape Bold 12** (`src/fonts/RuneScape-Bold-12.ttf`, CC0, from github.com/runestar/fonts; `font-display`, `--font-pixel`). Used for h1-h4, card/dialog titles, buttons and tabs. It is a bitmap font with native size 16px: use 16, 32, 48px for crisp edges, other sizes blur slightly. It has no weight variants; `font-synthesis-weight: none` stops fake bold. `RuneScape-Plain-12.ttf` and `RuneScape-Quill.ttf` are also in `src/fonts/` for later use.
- Body: **Noto Sans** (`font-sans`, `--font-body`).
- Signature `text-shadow: 1px 1px 0 #000` via `osrs-text-shadow` (on stone surfaces) and `osrs-heading` (theme-aware).
- Scale: page title `text-3xl`/`text-4xl` display, section `text-xl`, card title `text-xl`, body `text-sm`/`text-base`, captions `text-xs`.

## Bevel recipe

Raised: `border 1px edge` + `inset 2px 2px 0 var(--bevel-light)` + `inset -2px -2px 0 var(--bevel-dark)`.
Sunken is the same with light and dark swapped. Corners are 0-2px (`rounded-sm`). Soft shadows are replaced by hard pixel offsets (`shadow-md` = `2px 2px 0`).

Utilities (all in `src/styles/globals.css`, compose with `shadow-*`/`ring-*`):

| Class                | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `osrs-bevel`         | Raised bevel                                         |
| `osrs-bevel-inset`   | Sunken bevel                                         |
| `osrs-panel`         | Textured card/parchment panel with bevel             |
| `osrs-panel-inset`   | Recessed field (inputs, selects, tab tray, bars)     |
| `osrs-slot`          | Inventory slot (Tiles)                               |
| `osrs-btn`           | Stone game button, orange text, yellow on hover      |
| `osrs-texture`       | Grain + leather texture only                         |
| `osrs-text-shadow`   | 1px black text shadow                                |
| `osrs-heading`       | Display face + theme-aware shadow                    |
| `osrs-qty`           | Item-quantity number (yellow, shadowed)              |
| `osrs-mark`          | Small bevelled marker box on a Tile (battleship result) |
| `osrs-divider`       | Two-tone etched rule                                 |
| `osrs-tooltip`       | Pale-yellow examine box (Tooltip, HoverCard)         |
| `osrs-board-pane`    | Size container the Board is fitted into (see below)  |
| `osrs-board-fit`     | The Board grid; sizes its slots with `--s`           |
| `osrs-tile`          | Tile slot as an inline-size container (`@max-[43px]/tile:`) |
| `osrs-tile-text`     | Slot-relative type: `clamp(9px, 16cqw, 16px)`        |

Textures are inline SVG data URIs (feTurbulence grain and a 6px leather checker) at very low opacity.

## Component states

- **Button**: default = stone + orange text; hover = lighter stone + yellow text; active = inverted bevel, 1px down; focus = 2px ring; disabled = 50% opacity. Variants: destructive (red stone), outline (recessed), secondary (raised), ghost, link.
- **Badge**: square, 1px edge, inner highlight. Variants include `success`, `warning`, `info`, `pending`.
- **Tabs**: recessed tray; active tab is a raised stone button with orange text.
- **Progress / AnimatedProgress**: recessed track, green notched fill (10% ticks), like an XP/HP bar.
- **Tooltip / HoverCard**: `osrs-tooltip` pale yellow box, black text, black border.
- **Dialog / Card / Toast**: `osrs-panel`; dialog title is orange display text; close is a small red-X stone square.
- **Tile**: inventory slot; completed = green check overlay, submitted = pending marker, `osrs-qty` XP number top-left.
- **Selected Tile**: `ring-2 ring-inset ring-osrs-yellow` on top of the slot bevel (an inset ring never leaves the slot, so it cannot be clipped by the 2px minimum gap). The selected Tile is also `aria-selected` and lives in the URL as `?tile=`.
- **Hidden Tile**: keeps its grid cell so the geometry never shifts. Players see an empty, `aria-hidden`, unfocusable cell; managers see a dashed placeholder ("Click to reveal" while editing the layout).
- **Locked Tier Tile** (tier ladder): `opacity-60 saturate-50` plus a centred lock glyph. It can still be selected; the panel says how much XP is missing.
- Motion respects `prefers-reduced-motion`.

## Event workspace

`/events/[id]` (and read-only `/public/events/[id]`) is one workspace: the Board on the left, a tabbed side panel (Tile | Teams | Prize | Info) on the right, and a one-row summary bar on top. Shareable state lives in the URL: `?board=&tile=&panel=tile|teams|prize|info&teamId=`.

### Fit board

The Board must be fully visible on desktop (>= 1024px) without page scroll, so slot size is derived from the space it is given instead of from padding and `min-h-*` classes.

- `.osrs-board-pane` is a **size container** (`container-type: size`, `height: 100%`, `min-height: 0`). It sits in a flex column (`flex-1 min-h-0`) under the Board header; the workspace height is `calc(100dvh - var(--nav-h) - var(--nav-gap))` (`--nav-h` / `--nav-gap` are defined next to the textures in `globals.css` and used by the navbar).
- `.osrs-board-fit` is the grid. Set the unitless `--cols` and `--rows` (and `--vgaps` when the vertical gap count is not `rows - 1`, e.g. tier ladders) on it - `FitBoard` does this.
- Gap and padding: `--g = --p = clamp(2px, 1cqmin, 10px)`.
- Slot size: `--s = max(36px, min((100cqw - 2p - 2px - (cols-1)g) / cols, (100cqh - 2p - 2px - vgaps*g) / rows))`, columns `repeat(var(--cols), var(--s))`, `grid-auto-rows: var(--s)`. The 2px is the board frame border. The maths is mirrored in `src/lib/board-fit.ts` (unit tested).
- At the 36px floor the pane scrolls (`overflow: auto`, auto margins keep the board reachable) - a rare case for 10x10 boards on small screens.
- Below 1024px the pane is an inline-size container only: the board fits the width and the page scrolls vertically.
- Type scales with the slot: every Tile is an inline-size container, text uses `clamp(9px, 16cqw, 16px)` and the title and `osrs-qty` XP number are hidden below 44px (`@max-[43px]/tile:hidden`), leaving the image with a `title` tooltip.
- **Tier ladder** (progression boards, read-only): stacked tier bands, each a thin header (0.45 of a slot) plus that tier's Tiles wrapped at the column count. Effective rows = Tile rows + 0.45 per tier; `grid-template-rows` is set explicitly per band. `ProgressionBingoGrid` stays as the layout-edit view and scrolls inside the pane.

### Keyboard

The Board is a single tab stop (roving tabindex): arrows move by row/column, Home/End jump within the row, Enter/Space select, Escape clears the selection, `[` / `]` switch Boards. Accessible name: "Row r, column c: Title, N XP, status".

### Drawer (mobile)

Below 1024px a selected Tile opens the Tile panel in a **non-modal** vaul `Drawer` (`modal={false}`, no overlay, page stays interactive) with snap points `96px / 60% / 92%`. Closing it (swipe down or the X) removes `?tile=`. Teams, Prize and Info render below the Board in normal page scroll. Exactly one Tile panel is mounted at a time (`useIsDesktop`).

### Side panel

Only the panel body scrolls (`overflow-y-auto`), never the page. Fixed width `clamp(360px, 30vw, 480px)`. The Tile tab has sub-tabs Details | Submissions (| Goals (edit) for managers). Without a selection it shows the viewed Team's progress and a "needs attention" list (changes requested first, then pending).

## Battleship ship placement

`/events/[id]/bingos/[bingoId]/ships?teamId=` (a Server Component under the `(manage)` layout) places one team's fleet on the fit board.

- **Cells** are laid out by each Tile's `index` (hidden Tiles keep their cell, shown as a dashed, disabled "Hidden" slot). Same keyboard model as the Board: one tab stop, arrows via `moveGridFocusSkipping`, Enter/Space place, Escape cancels the ship being built. Accessible name: "Row 2, column 3, Tile 8, ship of length 3" / "empty".
- **Ships are never told apart by colour.** Every ship uses the `info` / `info-foreground` pair (about 13:1 on Stone and 8:1 on Parchment against the slot), each segment shows the ship length as a numeral, neighbouring segments are joined by a bar, and the ship being built has a dashed border. A selected ship gets `ring-2 ring-inset ring-osrs-yellow` plus a 2px black inner frame, because yellow on the Stone `info` cyan is only 1.3:1.
- **Fleet palette**: a native radio group, one entry per ship length with the aggregated required count; progress is a `success`/`pending` badge with a check or clock and the text "1/2 placed".

## Battleship board markers

On a battleship Board the viewer's own Team sees the result of its attacks on the main Board. Data comes from the Server Component (`getBattleshipWorkspaceInfo`, only from the start on) as `Set`s built once in `EventWorkspace`; nothing is fetched on the client.

- **Placement**: bottom-left of the Tile (top-left is the `osrs-qty` XP number, top-right is pending / changes requested, bottom-right is the completed check). Size `max(12px, 22cqw)`, same as the check. `osrs-mark` is the box (1px black edge, hard 1px highlight); colours come from utilities. The marker has `role="img"`, an `aria-label` and `data-mark="hit|miss|sunk"`.
- **Shapes, never colour alone**: hit = solid X on `bg-danger` (dark glyph on Stone, where `danger` is pale pink; light glyph on Parchment), miss = hollow dot on `bg-secondary` with a `ring-muted-foreground` outline, sunk = ship glyph on `bg-destructive` with `ring-osrs-yellow`. One `BattleshipMarkBadge` draws all three for the Tile, the legend and the Tile panel.
- **Priority**: the completed check stays. Sunk wins over hit. Hit and sunk add a `ring-2 ring-danger` overlay on the Tile (an overlay, because the Tile face would cover an inset ring of the slot; the yellow selection ring wins while selected). A miss dims the face with `saturate-50`.
- **Contrast** (sampled from screenshots): marker edge against the Tile face, hit 3.7:1 Stone / 4.4:1 Parchment, miss ring 4.4:1 / 6.4:1, sunk edged by the yellow ring (8.7:1 on Stone) and 4.1:1 on Parchment; glyph against the fill at least 3.7:1.
- **Accessible name**: the Tile name gains ", hit", ", miss" or ", sunk" ("Row 1, column 1: Title, 3 XP, completed, hit").
- **Blind Tile** (`isBlind`): a neutral `osrs-slot` with its "Tile N" text, name "Row 1, column 1: Tile 7, objective hidden until the event starts", `aria-disabled`. It keeps its place in the roving focus order (unlike a hidden Tile it is not skipped), cannot be opened (no `?tile=`), and never carries a marker.
- **Legend**: in the Board header info row after the start, a `role="list"` with the same glyphs and labels (Hit / Miss / Sunk) and one line on when the result is learned. Before the start the blind-board note stays.
- **Sunk announcement**: when a refresh of the page props brings newly sunk Tiles, a default (not destructive) toast "Ship sunk!" and a polite live region. Nothing on first render. No motion is used.
- **Tile panel**: a completed Tile shows "Hit", "Miss" or "Ship sunk" with the same glyph.
