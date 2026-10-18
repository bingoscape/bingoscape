import "server-only"

import { eq } from "drizzle-orm"

import { levelAllows, READ_DECISIONS } from "@/lib/authz/read-policy"
import { logger } from "@/lib/logger"
import { db } from "@/server/db"
import {
  images,
  submissions,
  teamTileSubmissions,
  tiles,
} from "@/server/db/schema"
import { getReadPolicyMode, getTileReadAccess } from "./read"

/**
 * Who may fetch an uploaded Submission image from `/api/uploads` (decision 4 of
 * the RBAC epic, `READ_DECISIONS.uploads`).
 *
 * - `public-url` (what the application did before the policy): anybody holding
 *   the unguessable URL; the response is cached publicly for a year.
 * - `follow-event-visibility`: only those who may see the Submission in the
 *   Event: its managers and, for participants, the Submissions of a Tile they
 *   may read (hidden and Blind Tiles excluded; on a battleship Board only their
 *   own Team's). The response is cached privately and for a shorter time, since
 *   a viewer can lose access. A file no Submission refers to is not served.
 *
 * Not a "use server" module.
 */

export interface UploadAccess {
  allowed: boolean
  cacheControl: string
}

const PUBLIC_CACHE = "public, max-age=31536000, immutable"
const PRIVATE_CACHE = "private, max-age=3600"

/** `relativePath` is the part after `/api/uploads/`. */
export async function getUploadAccess(
  relativePath: string
): Promise<UploadAccess> {
  // The relaxed read policy restores the pre-policy behaviour: a public URL.
  if (
    READ_DECISIONS.uploads === "public-url" ||
    getReadPolicyMode() === "relaxed"
  ) {
    return { allowed: true, cacheControl: PUBLIC_CACHE }
  }

  try {
    const owners = await db
      .select({ tileId: tiles.id, teamId: teamTileSubmissions.teamId })
      .from(images)
      .innerJoin(submissions, eq(submissions.imageId, images.id))
      .innerJoin(
        teamTileSubmissions,
        eq(teamTileSubmissions.id, submissions.teamTileSubmissionId)
      )
      .innerJoin(tiles, eq(tiles.id, teamTileSubmissions.tileId))
      .where(eq(images.path, `/uploads/${relativePath}`))

    for (const owner of owners) {
      const board = await getTileReadAccess(owner.tileId)
      if (!board || !levelAllows(board.access.level, "member-data")) continue
      if (board.isManager) return { allowed: true, cacheControl: PRIVATE_CACHE }
      const ownTeam = board.access.actor?.teams.some(
        (t) => t.teamId === owner.teamId
      )
      if (board.board.bingoType !== "battleship" || ownTeam) {
        return { allowed: true, cacheControl: PRIVATE_CACHE }
      }
    }
  } catch (error) {
    logger.error({ error }, "Upload access lookup failed")
  }
  return { allowed: false, cacheControl: "no-store" }
}
