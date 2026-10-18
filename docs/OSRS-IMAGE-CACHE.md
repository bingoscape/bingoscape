# OSRS Wiki image cache

Bingoscape serves OSRS Wiki images from its own server. The first use of an image fetches it from `oldschool.runescape.wiki` once; every later request is answered from a local cache. This page describes how it works and how to operate it. It was built in epic #226.

## Why

Wiki images used to be hotlinked, so every viewer's browser fetched them from the wiki. `next/image` alone does not fix that: its cache lives in `.next/cache`, which is lost when the container is replaced on deploy, and every width/quality variant is a separate upstream fetch. The Tile editor's image search also called the wiki API from the browser (up to 21 calls per search).

## How it works

- **Read-through route** `GET /api/osrs-image/<key>`. The key is the wiki path under `/images/` (for example `thumb/Giant_frog.png/800px-Giant_frog.png`). The route is public; the image is the wiki's public file.
- **Allowlist** (`src/lib/osrs-image.ts`): the host is fixed to `oldschool.runescape.wiki`, the path must start with `/images/` and match a strict file name pattern (thumbnails included), no SVG. The server builds the upstream URL from the key, so no caller supplies a URL. A `?hash` query is dropped, so one image has one key.
- **Fetch** (`src/server/osrs-image/cache.ts`): redirects are not followed, 5 s timeout, 2 MB cap, only png/gif/jpeg/webp with a matching magic-byte check, written to a temp file and renamed. At most 4 upstream fetches run at once. Every request identifies itself with the User-Agent contact from `OSRS_WIKI_CONTACT_EMAIL` (a Discord handle).
- **One fetch per image.** The state lives in the table `osrs_image_cache` (status `ok` / `not_found` / `error`, file name, content type, size, `etag`, `last_modified`, `fetched_at`, `refreshed_at`, `attempts`, `retry_after`). A per-key `pg_advisory_xact_lock` makes concurrent first requests, also across processes, produce one fetch.
- **Failures** are recorded with an exponential backoff (`not_found`: 24 h, doubling to 7 days; other errors: 5 min, doubling to 6 h). Until `retry_after` passes the route answers with a placeholder image and never asks the wiki again.
- **Abuse control:** cache misses are rate limited per IP (`osrsImageMiss`, 120 per minute); cache hits are not limited.
- **Responses** carry `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` and an `ETag` (not `immutable`), so a refreshed image reaches browsers within a day.
- **Rewrite at render time, not in the database.** Stored values stay wiki URLs; `toProxyUrl` (`src/lib/osrs-image.ts`) rewrites an allowlisted wiki URL to `/api/osrs-image/<key>` where URLs are rendered (`getOptimizedImageUrl`) and where the server inlines images (the event Open Graph image). Old rows, templates, exports and the rollback keep working without a backfill.
- **Tile editor search** runs as a server action (`searchWikiImages`), cached and rate limited, so the browser no longer calls the wiki API.

### Not cached

- **RS3 images** (`runescape.wiki`) are still hotlinked: the default RS3 images (`getRandomFrog("rs3")`) and the RS3 image search of the Tile editor. Caching them would need a host segment in the cache key and is a separate decision.
- **User-pasted URLs** of any other host, and wiki image URLs a user writes into a Markdown description, are rendered as they are (the browser loads them from their host).
- The RuneLite API returns stored values, so a wiki URL stays a wiki URL there.

## Where the files are

- Docker: the host directory `~/bingoscape/osrs-image-cache` is mounted at `/app/data/osrs-images` (`docker-compose.yml`, `OSRS_IMAGE_CACHE_DIR`). `scripts/deploy.sh` and `scripts/init-server.sh` create it with owner `1001` (the `nextjs` user in the container).
- Local development: `./.data/osrs-images` (git-ignored) unless `OSRS_IMAGE_CACHE_DIR` is set.
- Files are named `<sha256(key)>.<ext>`. They are deliberately not in `public/uploads`: the uploads route applies the submission-image access policy (`src/server/authz/uploads.ts`) and derives the content type from the file extension.
- There is no size cap and no eviction. Evicting would break "fetched once". The super-admin page shows the number of images and their total size so growth stays visible (see Monitoring); revisit if it grows too much.

## Backups

The cache is **regenerable and not backed up**. `scripts/backup-db.sh` dumps the database only, so a restored database has `osrs_image_cache` rows without files. That is safe: an `ok` row whose file is missing counts as a miss and is fetched again on the next request (or by the warm-up). The same holds when the volume is deleted or replaced.

## Refresh and purge

Super admins manage the cache at `/super-admin/image-cache`:

- **Refresh** (one image, or all) sends a conditional request (`If-None-Match` / `If-Modified-Since`). An unchanged image costs a 304 and keeps its file; a changed one is replaced. Refreshing ignores `retry_after`, and a failed refresh keeps the cached copy. "Refresh all" runs in the background at about one request per second and can be resumed after a restart (the stale marks are in the database).
- **Purge** deletes the row and the file; the next request fetches the image again.
- Browsers keep a served image for up to one day, so a changed image can take that long to show for viewers (or a hard reload).

All of these are audited admin actions.

## Monitoring

- **Fetch log:** every request to the wiki writes one JSON log line `OSRS image fetched from the wiki` with `key`, `result` (`image`, `not_modified`, `not_found`, `error`), `httpStatus` (null when there was no answer), `bytes`, `durationMs` and `conditional` (true for a refresh). `docker compose logs app | grep "OSRS image fetched"` shows them. A page view of a warm cache produces none.
- **Super-admin page:** counts of cached images (with their total size), images waiting for a refresh, `not_found` and `error` rows, plus the filterable table of all keys.

## Warm-up script (optional)

Lazy fetching already covers every image; the warm-up only front-loads the cost so the first viewer of a board does not wait for the wiki.

```bash
npm run images:warm -- --dry-run   # counts only: no request, no write
npm run images:warm                # fetch what is missing, about 1 image per second
```

`scripts/warm-osrs-image-cache.ts` collects the distinct wiki image URLs from `tiles.header_image`, `item_goals.image_url`, `bingo_templates.preview_image` and every string of the template JSON, plus the hard-coded frog images, metric icons and the showcase template. URLs of other hosts (RS3 included) are skipped, and URLs that differ only in `?hash` or encoding count once. It then fetches the images that are not cached yet through the same code path as the route.

- It is idempotent and resumable: cached images and images still inside their backoff are skipped, so a second run only does what is left. Ctrl-C finishes the current image and stops.
- It writes `osrs_image_cache` rows and files, so run it where `DATABASE_URL` and `OSRS_IMAGE_CACHE_DIR` point at the database and the volume you want to fill, with the wiki contact configured (`OSRS_WIKI_CONTACT_EMAIL`). The production image contains neither the script nor its tooling (it needs `npm` and the sources); on the server, run it from a checkout of the repository with the server's `.env`, as the user that owns the cache directory (UID 1001), or fill a development cache. Check `--dry-run` first.
- After a warm-up, loading an existing board produces no wiki request from the server (the fetch log stays silent) and none from the browser.

## Rollback: `OSRS_IMAGE_PROXY=false`

Set `OSRS_IMAGE_PROXY=false` in the server `.env` (and the `OSRS_IMAGE_PROXY` secret so the next deploy keeps it) and restart the app container. It is read per request, so no rebuild is needed. Then stored wiki URLs are rendered as they are and the browser loads images from the wiki again, as before the cache. No database change is involved; the cache route keeps working but is no longer linked.

What the flag leaves alone, on purpose:

- **Content-Security-Policy:** `img-src` is `'self' data: blob: https:` and names no wiki host (Markdown descriptions, avatars and RS3 images need `https:` anyway), so the browser may load wiki images again without a CSP change. `connect-src` is `'self'` because the wiki search runs on the server; it does not depend on the flag either. The CSP therefore does not need to follow the flag.
- **`next.config.mjs` `remotePatterns`:** keeps `oldschool.runescape.wiki` (and `runescape.wiki`). It is frozen at build time and cannot follow a runtime flag. With the flag off, the image optimizer of every `<Image>` that is not `unoptimized` fetches wiki URLs and answers 400 for a host that is not listed. It is a server-side allowlist; the browser never contacts the wiki because of it.

## Adding a host

The cache is OSRS-only by design (fixed host, no user-supplied URL). Another host, RS3 for example, is a separate decision because it changes the key. Roughly:

1. Add the host to `src/lib/wiki-hosts.js` and teach `parseWikiImageUrl` / `normalizeWikiImagePath` (`src/lib/osrs-image.ts`) a host segment in the key, so two hosts cannot collide. Existing keys need a migration (add-first, compatible with the previous app version).
2. Build the upstream URL from host and key in `fetchUpstream` (`src/server/osrs-image/cache.ts`); keep the host a fixed allowlist, never taken from a request.
3. Rewrite the new host in `toProxyUrl`, and apply `toProxyUrl` where its URLs are generated (`getRandomFrog("rs3")`).
4. Keep it in `remotePatterns` (`next.config.mjs`) and `safePreviewImage` (`src/lib/template-preview.ts`), and extend the tests of the allowlist and of the route.
5. Include it in the warm-up collector (`src/server/osrs-image/warm.ts`).
