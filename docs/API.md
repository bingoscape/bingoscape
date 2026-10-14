# BingoScape Next API Documentation

This document provides comprehensive documentation for the BingoScape Next API, including both web application endpoints and RuneLite plugin integration.

## Table of Contents

- [Authentication](#authentication)
- [RuneLite Plugin API](#runelite-plugin-api)
  - [Board Payload](#board-payload)
  - [Error Codes](#progression-and-battleship-error-codes)
- [Web Application API](#web-application-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

## Authentication

BingoScape Next supports two authentication methods depending on the client type:

### Session-based Authentication (Web UI)

The web application uses NextAuth.js with Discord OAuth for user authentication. Sessions are automatically managed by the framework.

```typescript
// Server-side session access
import { getServerAuthSession } from "@/server/auth"

const session = await getServerAuthSession()
if (!session?.user?.id) {
  // User not authenticated
}
```

### API Key Authentication (RuneLite Plugin)

External clients like the RuneLite plugin use API key authentication with Bearer tokens.

```http
Authorization: Bearer bsn_your_api_key_here
```

**API Key Format:** `bsn_` prefix followed by a unique identifier (unchanged).

**Key lifecycle.** The server stores only a SHA-256 hash and the first 8 characters of a key. The full key is shown **once**, when it is created (web UI or `POST /api/runelite/keys`); lose it and create a new one. A key can carry an expiry (`expiresAt`), can be revoked (`revokedAt`) and has scopes: `read` (every read route, `POST /api/runelite/auth`) and `submit` (`POST .../submissions`, `POST .../auto-submissions`, `POST /api/runelite/items/check`). Keys created before this change and keys created in the web UI without a choice have both scopes. An expired, revoked, unknown or insufficiently scoped key is answered like an invalid one: `401 { "error": "Invalid API key" }`.

## RuneLite Plugin API

The RuneLite plugin API provides endpoints specifically designed for the OSRS game client integration.

**Base URL:** `/api/runelite`

### Authentication Endpoints

#### Validate API Key

```http
POST /api/runelite/auth
Content-Type: application/json

{
  "apiKey": "bsn_your_api_key_here"
}
```

**Response:**

```json
{
  "valid": true,
  "user": {
    "id": "user-uuid",
    "name": "DisplayName",
    "runescapeName": "RSN",
    "image": "https://avatar-url"
  }
}
```

### Event Management

#### Get User Events

```http
GET /api/runelite/events
Authorization: Bearer bsn_your_api_key_here
```

Returns every event the user created or participates in, as long as it has at least one visible board. Hidden boards (`visible: false`) are never listed here, not even for managers. Boards of **every** `bingoType` are returned (`standard`, `progression` and `battleship`).

Each entry of `bingos` is a full [board payload](#board-payload) for the calling user's team, the same object `GET /api/runelite/bingos/{bingoId}` returns, including `apiVersion` and the `progression` / `battleship` blocks where they apply.

**Response (abridged):**

```json
[
  {
    "id": "event-uuid",
    "title": "Weekly Bingo Competition",
    "description": "Clan weekly bingo event",
    "startDate": "2025-08-04T00:00:00Z",
    "endDate": "2025-08-11T23:59:59Z",
    "locked": false,
    "public": false,
    "role": "participant",
    "userTeam": {
      "name": "Team Alpha",
      "members": [{ "isLeader": false, "runescapeName": "RSN" }]
    },
    "bingos": [
      {
        "apiVersion": "2.1",
        "id": "bingo-uuid",
        "title": "PvM Bingo",
        "description": "Player vs Monster challenges",
        "rows": 5,
        "columns": 5,
        "bingoType": "standard",
        "visible": true,
        "tiles": ["..."]
      }
    ]
  }
]
```

`userTeam` is `null` when the user is on no team.

### Bingo Data

#### Get Bingo Details

```http
GET /api/runelite/bingos/{bingoId}
Authorization: Bearer bsn_your_api_key_here
If-None-Match: "a1b2c3..."   # optional, see Caching
```

Returns the [board payload](#board-payload) as seen by the calling user's team. The response depends on who asks: the team (progress, marks, unlocked tiers) and the role (managers see battleship boards that are still blind to players).

**Access rules**

Only the event's participants, its creator and its managers can read a board, and only managers can read a hidden board. Every other case answers with the same `404`, so the response does not reveal that a board exists:

| Status | Body | When |
| --- | --- | --- |
| `401` | `{ "error": "Invalid API key" }` | Missing or invalid key |
| `404` | `{ "error": "Bingo not found" }` | Unknown id, caller is not a participant of the event, or the board is hidden and the caller is not a manager |
| `429` | `{ "error": "Too many requests" }` | More than 60 requests per minute for this user. `Retry-After` holds the seconds to wait |
| `304` | none | `If-None-Match` matches the current `ETag` |
| `500` | `{ "error": "An error occurred while fetching bingo data" }` | Server error |

Battleship boards are served like any other board; they no longer answer `404`.

**Caching**

Every `200` and `304` carries:

```http
ETag: "0f3c9a8e5d..."
Cache-Control: private, no-cache
```

- The `ETag` is a hash of the response body, **excluding `battleship.serverNow`** (which changes on every call). While nothing else changes, the `ETag` stays the same.
- The `ETag` differs per view: two users on different teams, or a player and a manager, get different tags for the same board, so a tag must not be shared between them.
- Send the last `ETag` as `If-None-Match` and the server answers `304` with an empty body (and the same `ETag`) when nothing changed. A list of tags, weak tags (`W/"..."`) and `*` are accepted.
- `Cache-Control: private, no-cache` means a client may keep the response but has to revalidate it on every use.

**Rate limit**

60 requests per minute per user on this endpoint. The counter is kept in memory per server process and a `304` counts like a `200`. See [Rate Limiting](#rate-limiting).

**Polling recommendation**

The plugin has no push channel for the board, so it polls. Poll no faster than every 5 seconds, send `If-None-Match` with the last `ETag` so an unchanged board costs one cheap `304`, and stay well under 60 requests a minute (a 5 to 10 second interval is fine; back off for the `Retry-After` seconds after a `429`). Take the clock from `battleship.serverNow` rather than from the local machine when comparing against `battleship.startDate`.

#### Board Payload

All additions in `apiVersion` `2.1` are additive: existing fields keep their names and meaning. A client that does not know a field can ignore it, and a payload without `bingoType` should be treated as `"standard"`.

```json
{
  "apiVersion": "2.1",
  "id": "bingo-uuid",
  "title": "PvM Bingo",
  "description": "Player vs Monster challenges",
  "rows": 5,
  "columns": 5,
  "codephrase": null,
  "locked": false,
  "visible": true,
  "bingoType": "standard",
  "tiles": [
    {
      "id": "tile-uuid",
      "title": "Kill Zulrah",
      "description": "Defeat Zulrah once",
      "headerImage": "image-url",
      "weight": 10,
      "index": 0,
      "tier": 0,
      "isHidden": false,
      "tierLocked": false,
      "isBlind": false,
      "submission": {
        "id": "tile-uuid",
        "status": "not_submitted",
        "lastUpdated": null,
        "submissionCount": 0
      },
      "goals": [
        {
          "id": "goal-uuid",
          "description": "Kill Zulrah",
          "targetValue": 1,
          "progress": {
            "approvedProgress": 0,
            "totalProgress": 0,
            "approvedPercentage": 0,
            "isCompleted": false
          }
        }
      ],
      "goalTree": []
    }
  ]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `apiVersion` | string | `"2.1"` on every board payload |
| `bingoType` | `"standard"` \| `"progression"` \| `"battleship"` | |
| `tiles[].tier` | number | Tier of the tile; `0` on boards without tiers |
| `tiles[].tierLocked` | boolean | `true` for a stub tile in a tier the team has not unlocked. Always `false` on other boards |
| `tiles[].isBlind` | boolean | `true` for a redacted tile on a battleship board that has not started. Present (as `false`) on every board type |
| `progression` | object | Only when `bingoType` is `"progression"` and the caller is on a team |
| `battleship` | object | Only when `bingoType` is `"battleship"` |

The submission endpoints return this same payload with a few extra fields, see [Submission Management](#submission-management).

##### Progression boards

A progression board splits its tiles into tiers. Tier 0 is always unlocked. A higher tier unlocks once the team has earned enough XP from completed tiles of the tier below it (a tile's `weight` is its XP).

```json
{
  "bingoType": "progression",
  "progression": {
    "tierXpRequirements": [{ "tier": 0, "xpRequired": 5 }],
    "unlockedTiers": [0],
    "tierProgress": [
      { "tier": 0, "isUnlocked": true, "unlockedAt": "2026-10-01T12:00:00.000Z" }
    ],
    "tiers": [
      {
        "tier": 0,
        "isUnlocked": true,
        "unlockedAt": "2026-10-01T12:00:00.000Z",
        "earnedXp": 5,
        "xpRequired": 5
      },
      {
        "tier": 1,
        "isUnlocked": false,
        "unlockedAt": null,
        "earnedXp": 0,
        "xpRequired": 5
      }
    ]
  }
}
```

- `progression.tiers[]` is the new, complete summary: one entry for **every** tier on the board, locked ones included.
  - `earnedXp`: summed `weight` of the team's completed tiles in that tier.
  - `xpRequired`: XP needed **in that tier** to unlock the next one (the server default of 5 applies when a board sets none).
  - `unlockedAt` is `null` for tier 0 until the team has a tier row, and for locked tiers.
- `tierXpRequirements`, `unlockedTiers` and `tierProgress` are the older fields and stay unchanged. `unlockedTiers` always contains `0`, even for a team that has no stored tier progress yet.
- The `progression` block is omitted, and `tiles` is empty, for a player who is on no team.

**Locked tiles are stubs.** A tile in a locked tier carries only its place on the board:

```json
{
  "id": "tile-uuid",
  "title": "",
  "description": null,
  "headerImage": null,
  "weight": 0,
  "index": 7,
  "tier": 1,
  "isHidden": false,
  "tierLocked": true,
  "isBlind": false,
  "submission": { "id": "tile-uuid", "status": "not_submitted", "lastUpdated": null, "submissionCount": 0 },
  "goals": [],
  "goalTree": []
}
```

There is no title, description, image, goal or weight to show; render a locked cell and, using `progression.tiers`, "N XP needed" for the tier (`xpRequired - earnedXp` of the tier below). Submitting to a stub tile is refused with `TIER_LOCKED`.

##### Battleship boards

```json
{
  "bingoType": "battleship",
  "battleship": {
    "started": true,
    "startDate": "2026-10-10T18:00:00.000Z",
    "serverNow": "2026-10-13T10:00:00.000Z",
    "rules": [
      { "length": 2, "count": 1 },
      { "length": 3, "count": 2 }
    ],
    "marks": {
      "hitTileIds": ["tile-a", "tile-b"],
      "missTileIds": ["tile-c"],
      "sunkTileIds": ["tile-a", "tile-b"]
    },
    "opponentShipsSunk": 1,
    "opponentShipsTotal": 3
  }
}
```

| Field | Notes |
| --- | --- |
| `started` | `true` once the event's `startDate` has passed |
| `startDate`, `serverNow` | ISO timestamps. Use `serverNow` as the clock; `serverNow` is not part of the `ETag` |
| `rules` | The fleet each team places, sorted ascending by `length`. Public information |
| `marks` | The calling team's own shots. Ids refer to `tiles[].id` |
| `opponentShipsSunk` | Number of opponent ships the team has sunk |
| `opponentShipsTotal` | Total number of ships in the fleet rules (sum of `rules[].count`) |

- **Marks are about the caller's team only.** The position of an opponent's ship is never sent; the opponent figures are counts, and `opponentShipsTotal` comes from the public rules, not from what the opponent placed.
- **Marks are empty and `started` is `false` before the start**, and also for a manager who is on no team (that manager sees a plain board with no marks).
- **`hitTileIds` also contains the sunk tiles** (a sunk ship is a ship whose every tile was hit). When drawing, give `sunkTileIds` priority over `hitTileIds`, and `hitTileIds` over `missTileIds`.
- **Blind tiles.** Before the start, a player (anyone who does not manage the event) gets redacted tiles: `isBlind: true`, the title `"Tile N"`, and no description, image, goals, weight or progress. Event managers see the tiles unredacted. Submissions are refused on a blind board with `BOARD_BLIND`.

### Example Flow: conditional board poll

```http
GET /api/runelite/bingos/bingo-uuid
Authorization: Bearer bsn_your_api_key_here
```

```http
HTTP/1.1 200 OK
ETag: "0f3c9a8e5d1b4c7aa29e6f01d3b85c47"
Cache-Control: private, no-cache
```

```http
GET /api/runelite/bingos/bingo-uuid
Authorization: Bearer bsn_your_api_key_here
If-None-Match: "0f3c9a8e5d1b4c7aa29e6f01d3b85c47"
```

```http
HTTP/1.1 304 Not Modified
ETag: "0f3c9a8e5d1b4c7aa29e6f01d3b85c47"
Cache-Control: private, no-cache
```

### Submission Management

#### Get Tile Submissions

```http
GET /api/runelite/tiles/{tileId}/submissions
Authorization: Bearer bsn_your_api_key_here
```

**Response:**

```json
{
  "teamId": "team-uuid",
  "teamName": "Team Alpha",
  "status": "pending",
  "submissions": [
    {
      "id": "submission-uuid",
      "createdAt": "2025-08-04T12:00:00Z",
      "image": {
        "path": "/uploads/screenshot.png"
      },
      "submittedBy": {
        "id": "user-uuid",
        "name": "Player Name",
        "runescapeName": "RSN"
      }
    }
  ]
}
```

#### Submit Screenshot

```http
POST /api/runelite/tiles/{tileId}/submissions
Authorization: Bearer bsn_your_api_key_here
Content-Type: multipart/form-data

image: <file>
```

**Response:**

The full [board payload](#board-payload) for the caller's team after the submission, plus two fields:

```json
{
  "apiVersion": "2.1",
  "id": "bingo-uuid",
  "bingoType": "battleship",
  "tiles": ["..."],
  "battleship": { "...": "..." },
  "tierUnlocked": null,
  "shot": null
}
```

A plain screenshot submission never completes a tile, so on this route `tierUnlocked` and `shot` are always `null`. A completion happens through auto-submissions or item checks (below), or when a manager approves the submission.

**Errors**

| Status | `code` | When |
| --- | --- | --- |
| `403` | `TIER_LOCKED` | The tile is in a progression tier the team has not unlocked. Body also has `tier` and `xpNeeded` |
| `404` | `BOARD_BLIND` | The tile belongs to a battleship board that has not started and the caller does not manage the event |
| `403` | `EVENT_NOT_STARTED` | Battleship board and the event has not started (applies to managers too) |

#### Auto-Submit Screenshot

```http
POST /api/runelite/tiles/{tileId}/auto-submissions
Authorization: Bearer bsn_your_api_key_here
Content-Type: multipart/form-data

image: <file>
metadata: {"npcId": 2042, "sourceName": "Zulrah", "itemId": 12922, "quantity": 1}   # optional JSON
```

The server matches the metadata against the tile's goals and updates progress. If that completes the tile it is approved. It is guarded by the same checks as the plain submission route (`TIER_LOCKED`, `BOARD_BLIND`, `EVENT_NOT_STARTED`).

**Response:** the [board payload](#board-payload) plus

```json
{
  "autoApproved": true,
  "matchedGoalId": "goal-uuid",
  "tierUnlocked": 1,
  "shot": { "tileId": "tile-uuid", "result": "hit" }
}
```

- `tierUnlocked`: the highest tier **newly** unlocked by this request, or `null`. A completion can unlock more than one tier in a row (a tier whose requirement is already met opens right away); you get the highest.
- `shot`: battleship boards only. What the completion did to the team's marks: `"hit"`, `"miss"` or `"sunk"` (the shot that sinks the last tile of a ship reports `"sunk"`). `null` on other boards, when the request did not complete a tile, or when the tile was already marked.

#### Check Items

```http
POST /api/runelite/items/check
Authorization: Bearer bsn_your_api_key_here
Content-Type: application/json

{
  "items": [{ "itemId": 4710, "itemName": "Ahrim's staff", "quantity": 1 }],
  "eventIds": ["event-uuid"]
}
```

Matches the items against the item goals of the caller's events and updates progress. Goals on blind battleship tiles and on tiles in locked progression tiers do not progress.

**Response:**

```json
{
  "success": true,
  "matched": [
    {
      "goalId": "goal-uuid",
      "itemName": "Ahrim's staff",
      "baseName": "Ahrim's staff",
      "previousValue": 0,
      "newValue": 1,
      "targetValue": 1,
      "isComplete": true,
      "tileId": "tile-uuid",
      "eventId": "event-uuid"
    }
  ],
  "tilesAutoCompleted": ["tile-uuid"],
  "tierUnlocked": 1,
  "scannedItems": 1,
  "matchedGoals": 1
}
```

`tierUnlocked` is the highest tier newly unlocked by this call, or `null`.

**`TIER_LOCKED`:** when every goal an item matched is in a locked tier, nothing can count and the call answers `403` with `{ "success": false, "error": "...", "code": "TIER_LOCKED", "tier": 1, "xpNeeded": 3 }` (the lock of the first locked match). If at least one match is open, the call succeeds and the locked matches are skipped.

### Progression and Battleship Error Codes

Error bodies of the submission routes carry a stable `code` next to the human readable `error`. Match on `code`, not on the message.

| `code` | Status | Routes | Meaning |
| --- | --- | --- | --- |
| `TIER_LOCKED` | `403` | submissions, auto-submissions, items/check | The tile's tier is locked. Extra fields: `tier` (the locked tier) and `xpNeeded` (XP still missing in the tier below) |
| `BOARD_BLIND` | `404` | submissions, auto-submissions | Tile of a battleship board that has not started, requested by someone who does not manage the event. It looks like a missing tile on purpose |
| `EVENT_NOT_STARTED` | `403` | submissions, auto-submissions | Battleship submit before the event's start date |

```json
{
  "error": "Tier 1 is still locked for your team",
  "code": "TIER_LOCKED",
  "tier": 1,
  "xpNeeded": 3
}
```

### API Documentation Endpoint

#### Get API Documentation

```http
GET /api/runelite/docs
```

Returns comprehensive API documentation in JSON format for programmatic consumption.

## Web Application API

The web application primarily uses Server Actions for data mutations, but includes several REST endpoints for specific functionality.

### File Uploads

#### Upload Static Files

```http
GET /api/uploads/{...path}
```

Serves uploaded images and files with proper content types and caching headers.

### Authentication

#### NextAuth Endpoints

```http
GET/POST /api/auth/{...nextauth}
```

Handles OAuth flows, session management, and authentication callbacks.

### Administrative

#### Super Admin Check

```http
GET /api/super-admin/check
Authorization: Session-based
```

Validates super admin permissions for administrative features.

#### System Health

```http
GET /api/uptime
```

Returns system uptime and health status.

## Server Actions

Server Actions provide type-safe data mutations without REST API overhead. They're used throughout the application for database operations.

### Bingo Management

```typescript
// Import server actions
import { createBingo, updateBingo, deleteBingo } from "@/app/actions/bingo"
import { createEvent, updateEvent } from "@/app/actions/events"
import { createTeam, assignTeamMembers } from "@/app/actions/team"

// Usage in components
const result = await createBingo(formData)
if (result.success) {
  // Handle success
} else {
  // Handle error
}
```

### Available Server Actions

- **Bingo Actions** (`/app/actions/bingo.ts`)
  - `createBingo(formData)` - Create new bingo board
  - `updateBingo(id, data)` - Update existing bingo
  - `deleteBingo(id)` - Delete bingo board
  - `toggleBingoVisibility(id)` - Show/hide bingo

- **Event Actions** (`/app/actions/events.ts`)
  - `createEvent(formData)` - Create new event
  - `updateEvent(id, data)` - Update event details
  - `deleteEvent(id)` - Delete event
  - `joinEvent(eventId)` - Join event

- **Team Actions** (`/app/actions/team.ts`)
  - `createTeam(eventId, name)` - Create team
  - `assignTeamMembers(teamId, userIds)` - Assign members
  - `removeTeamMember(teamId, userId)` - Remove member

- **Import/Export Actions** (`/app/actions/bingo-import-export.ts`)
  - `exportBingo(bingoId)` - Export bingo data
  - `importBingo(eventId, data)` - Import bingo board

## Error Handling

### Error Response Format

All API endpoints return consistent error responses:

```json
{
  "error": "Error message description",
  "details": {
    "field": "Specific field error",
    "code": "ERROR_CODE"
  }
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created successfully
- `400` - Bad request (invalid input)
- `401` - Unauthorized (invalid/missing authentication)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `409` - Conflict (duplicate resource)
- `422` - Validation error
- `500` - Internal server error

### Server Action Error Handling

Server Actions return result objects with success/error status:

```typescript
type ActionResult<T> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      error: string
      details?: Record<string, string>
    }
```

## Rate Limiting

The RuneLite polling endpoints are limited per user with an in-memory sliding window. The counters live in the server process, so they reset on a restart and are not shared between instances. A limited request answers `429` with a `Retry-After` header (seconds).

| Endpoint | Limit |
| --- | --- |
| `GET /api/runelite/bingos/{bingoId}` | 60 requests per minute per user |
| `GET /api/runelite/team-drops` | 30 requests per minute per user |
| `GET /api/runelite/team-tile-completions` | 30 requests per minute per user (separate budget) |

`304 Not Modified` answers count against the limit like any other. Use `If-None-Match` to keep polls cheap, not to avoid the limit; a poll every 5 to 10 seconds is well inside it.

`apiKeys.lastUsed` (shown in the key list on the web) is written at most once a minute per key, however many requests the key makes.

More limits (same mechanism, fixed in `src/lib/rate-limit-policies.ts`):

| Endpoint | Limit |
| --- | --- |
| `POST /api/runelite/auth` | 30 requests per minute per client IP |
| `POST /api/runelite/tiles/{tileId}/submissions` and `.../auto-submissions` | 30 uploads per minute per user (shared budget with the web upload form) |
| `GET /api/events/invite/{code}` | 30 requests per 15 minutes per client IP |

The web app also limits credentials sign-in (20 attempts per 15 minutes per IP, 10 per username and IP), sign-up (5 per hour per IP), invite links and redemptions, Event creation (10 per hour per user) and the Wise Old Man actions (20 per minute per user). A limited server action returns `{ "success": false, "error": "...", "code": "RATE_LIMITED", "retryAfterSeconds": n }`.

The limits assume a single app instance. The client IP is the last entry of `X-Forwarded-For`, the one the host nginx appends.

A submission is also refused with `403` (`code: "BOARD_LOCKED"`) when its Board is locked and with `400` (`code: "INVALID_FILE_TYPE"` / `"FILE_TOO_LARGE"`) for anything but a JPEG, PNG, GIF or WebP image of at most 25 MB. This is the same check the web upload form uses.

## Examples

### RuneLite Plugin Integration

```javascript
// Initialize plugin with API key
const apiKey = "bsn_your_api_key_here"
const baseUrl = "https://bingoscape.com/api/runelite"

// Validate API key
async function validateKey() {
  const response = await fetch(`${baseUrl}/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey }),
  })

  const result = await response.json()
  return result.valid
}

// Get user events
async function getUserEvents() {
  const response = await fetch(`${baseUrl}/events`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  return await response.json()
}

// Poll a board with If-None-Match (keep well under 60 requests a minute)
let boardEtag = null
let board = null
async function pollBoard(bingoId) {
  const response = await fetch(`${baseUrl}/bingos/${bingoId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(boardEtag ? { "If-None-Match": boardEtag } : {}),
    },
  })

  if (response.status === 304) return board // unchanged
  if (response.status === 429) {
    const wait = Number(response.headers.get("Retry-After") ?? 60)
    throw new Error(`Rate limited, retry in ${wait}s`)
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  boardEtag = response.headers.get("ETag")
  board = await response.json()
  return board
}

// Submit screenshot
async function submitScreenshot(tileId, imageFile) {
  const formData = new FormData()
  formData.append("image", imageFile)

  const response = await fetch(`${baseUrl}/tiles/${tileId}/submissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  return await response.json()
}
```

### Web Application Usage

```typescript
// Server Action usage in React component
'use client'

import { createBingo } from "@/app/actions/bingo"
import { useToast } from "@/hooks/use-toast"

export function CreateBingoForm({ eventId }: { eventId: string }) {
  const { toast } = useToast()

  async function handleSubmit(formData: FormData) {
    const result = await createBingo(formData)

    if (result.success) {
      toast({
        title: "Success",
        description: "Bingo created successfully"
      })
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive"
      })
    }
  }

  return (
    <form action={handleSubmit}>
      <input name="title" placeholder="Bingo Title" required />
      <input name="eventId" type="hidden" value={eventId} />
      <button type="submit">Create Bingo</button>
    </form>
  )
}
```

### Database Query Patterns

```typescript
// Example server action with database queries
import { db } from "@/server/db"
import { bingos, tiles, goals } from "@/server/db/schema"

export async function getBingoWithTiles(bingoId: string) {
  return await db.query.bingos.findFirst({
    where: eq(bingos.id, bingoId),
    with: {
      tiles: {
        with: {
          goals: true,
          teamTileSubmissions: {
            with: {
              submissions: {
                with: {
                  image: true,
                  user: true,
                },
              },
            },
          },
        },
      },
    },
  })
}
```

## Support

For API support and questions:

- **GitHub Issues**: [Report API bugs](https://github.com/bingoscape/bingoscape/issues)
- **Discord**: [Developer community](https://discord.gg/bingoscape)
- **Email**: support@bingoscape.com

## Changelog

- **v2.1.0** (RuneLite API) - `apiVersion: "2.1"` on every board payload. `/events` lists all board types. `GET /bingos/{id}` serves battleship boards, checks event access, and supports `ETag` / `If-None-Match`, with a 60/min rate limit. Added `tiles[].tierLocked`, `tiles[].isBlind`, `progression.tiers[]` and the `battleship` block. Submission responses carry `tierUnlocked` and `shot`. New error codes `TIER_LOCKED`, `BOARD_BLIND`, `EVENT_NOT_STARTED`. All changes are additive.
- **v1.1.0** - Added progression bingo support to export/import API
- **v1.0.0** - Initial API release with RuneLite plugin support
