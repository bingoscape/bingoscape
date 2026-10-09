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
| `osrs-divider`       | Two-tone etched rule                                 |
| `osrs-tooltip`       | Pale-yellow examine box (Tooltip, HoverCard)         |

Textures are inline SVG data URIs (feTurbulence grain and a 6px leather checker) at very low opacity.

## Component states

- **Button**: default = stone + orange text; hover = lighter stone + yellow text; active = inverted bevel, 1px down; focus = 2px ring; disabled = 50% opacity. Variants: destructive (red stone), outline (recessed), secondary (raised), ghost, link.
- **Badge**: square, 1px edge, inner highlight. Variants include `success`, `warning`, `info`, `pending`.
- **Tabs**: recessed tray; active tab is a raised stone button with orange text.
- **Progress / AnimatedProgress**: recessed track, green notched fill (10% ticks), like an XP/HP bar.
- **Tooltip / HoverCard**: `osrs-tooltip` pale yellow box, black text, black border.
- **Dialog / Card / Toast**: `osrs-panel`; dialog title is orange display text; close is a small red-X stone square.
- **Tile**: inventory slot; completed = green check overlay, submitted = pending marker, `osrs-qty` XP number top-left.
- Motion respects `prefers-reduced-motion`.
