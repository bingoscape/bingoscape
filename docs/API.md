# BingoScape Next API Documentation

This document provides comprehensive documentation for the BingoScape Next API, including both web application endpoints and RuneLite plugin integration.

## Table of Contents

- [Authentication](#authentication)
- [RuneLite Plugin API](#runelite-plugin-api)
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

**API Key Format:** `bsn_` prefix followed by a unique identifier

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

**Response:**
```json
[
  {
    "id": "event-uuid",
    "title": "Weekly Bingo Competition",
    "description": "Clan weekly bingo event",
    "startDate": "2025-08-04T00:00:00Z",
    "endDate": "2025-08-11T23:59:59Z",
    "userTeam": {
      "id": "team-uuid",
      "name": "Team Alpha",
      "isLeader": false
    },
    "role": "participant",
    "bingos": [
      {
        "id": "bingo-uuid",
        "title": "PvM Bingo",
        "description": "Player vs Monster challenges",
        "rows": 5,
        "columns": 5,
        "visible": true
      }
    ]
  }
]
```

### Bingo Data

#### Get Bingo Details
```http
GET /api/runelite/bingos/{bingoId}
Authorization: Bearer bsn_your_api_key_here
```

**Response:**
```json
{
  "id": "bingo-uuid",
  "title": "PvM Bingo",
  "description": "Player vs Monster challenges",
  "rows": 5,
  "columns": 5,
  "bingoType": "standard",
  "tiersUnlockRequirement": 5,
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
      "goals": [
        {
          "id": "goal-uuid", 
          "description": "Kill Zulrah",
          "targetValue": 1
        }
      ],
      "teamSubmissionStatus": "pending",
      "hasSubmissions": true
    }
  ]
}
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
```json
{
  "success": true,
  "teamId": "team-uuid",
  "teamName": "Team Alpha",
  "status": "pending",
  "submission": {
    "id": "submission-uuid",
    "createdAt": "2025-08-04T12:00:00Z",
    "image": {
      "path": "/uploads/new-screenshot.png"
    }
  }
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
type ActionResult<T> = {
  success: true
  data: T
} | {
  success: false
  error: string
  details?: Record<string, string>
}
```

## Rate Limiting

Currently, no explicit rate limiting is implemented, but it's recommended for production deployments:

- **API Key Requests**: 1000 requests per hour per key
- **File Uploads**: 10 uploads per minute per user
- **Authentication**: 5 login attempts per minute per IP

## Examples

### RuneLite Plugin Integration

```javascript
// Initialize plugin with API key
const apiKey = 'bsn_your_api_key_here'
const baseUrl = 'https://bingoscape.com/api/runelite'

// Validate API key
async function validateKey() {
  const response = await fetch(`${baseUrl}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ apiKey })
  })
  
  const result = await response.json()
  return result.valid
}

// Get user events
async function getUserEvents() {
  const response = await fetch(`${baseUrl}/events`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })
  
  return await response.json()
}

// Submit screenshot
async function submitScreenshot(tileId, imageFile) {
  const formData = new FormData()
  formData.append('image', imageFile)
  
  const response = await fetch(`${baseUrl}/tiles/${tileId}/submissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
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
                  user: true
                }
              }
            }
          }
        }
      }
    }
  })
}
```

## Support

For API support and questions:
- **GitHub Issues**: [Report API bugs](https://github.com/bingoscape/bingoscape-next/issues)
- **Discord**: [Developer community](https://discord.gg/bingoscape)
- **Email**: support@bingoscape.com

## Changelog

- **v1.1.0** - Added progression bingo support to export/import API
- **v1.0.0** - Initial API release with RuneLite plugin support