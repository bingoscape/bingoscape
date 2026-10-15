/**
 * The RuneScape wiki hosts the app talks to, in one place.
 *
 * Plain ESM JavaScript so `next.config.mjs` and `security-headers.js` can
 * import it (they run before any TypeScript is compiled); the TypeScript
 * modules (`osrs-image.ts`, `template-preview.ts`) import it through `@/lib`.
 */

/**
 * The Old School wiki. Its images are the only ones the app caches itself
 * (`osrs-image.ts`); the host is fixed so no user-supplied host is ever
 * fetched.
 */
export const OSRS_WIKI_HOST = "oldschool.runescape.wiki"

/**
 * The RuneScape 3 wiki. Its images are still hotlinked and not cached (the
 * default RS3 images and the RS3 image search of the Tile editor use it).
 */
export const RS3_WIKI_HOST = "runescape.wiki"

/** Every wiki host the app loads images from or queries the API of. */
export const WIKI_HOSTS = [OSRS_WIKI_HOST, RS3_WIKI_HOST]
