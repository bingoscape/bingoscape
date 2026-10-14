/**
 * The one gate every submission upload passes before anything is written to
 * disk: the manual `submitImage` action and the two RuneLite routes
 * (submissions, auto-submissions) all call `assertCanSubmit` (RBAC 7/8, #190).
 *
 * It checks only what does not depend on the caller's role: the Board must not
 * be locked, and the file must be an allowed image type of acceptable size.
 * Membership, Team, tier and hidden-Tile rules stay with their callers.
 */

export const ALLOWED_SUBMISSION_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const

/** 25 MB, the server action body limit (next.config.mjs). */
export const MAX_SUBMISSION_FILE_SIZE = 25 * 1024 * 1024

export type SubmissionRejectionCode = "BOARD_LOCKED" | "INVALID_FILE_TYPE" | "FILE_TOO_LARGE"

/** Thrown by `assertCanSubmit`; `status` is the HTTP status a route answers with. */
export class SubmissionRejectedError extends Error {
  constructor(
    message: string,
    readonly code: SubmissionRejectionCode,
    readonly status: 400 | 403
  ) {
    super(message)
    this.name = "SubmissionRejectedError"
  }
}

export interface SubmissionCandidate {
  /** The Board the Tile belongs to. */
  board: { locked: boolean }
  file: { type: string; size: number }
  /**
   * A manager of the Event may submit on a locked Board (to correct things
   * for a Team). The RuneLite routes never pass this: the plugin is for
   * players.
   */
  managerOverridesLock?: boolean
}

/** Throws `SubmissionRejectedError` when the submission must be refused. */
export function assertCanSubmit(candidate: SubmissionCandidate): void {
  if (candidate.board.locked && !candidate.managerOverridesLock) {
    throw new SubmissionRejectedError(
      "This bingo is locked. No submission possible",
      "BOARD_LOCKED",
      403
    )
  }
  const { type, size } = candidate.file
  if (!(ALLOWED_SUBMISSION_MIME_TYPES as readonly string[]).includes(type)) {
    throw new SubmissionRejectedError(
      "Invalid file type. Only JPEG, PNG, GIF and WebP are accepted.",
      "INVALID_FILE_TYPE",
      400
    )
  }
  if (size > MAX_SUBMISSION_FILE_SIZE) {
    throw new SubmissionRejectedError(
      "File too large. Maximum size is 25 MB.",
      "FILE_TOO_LARGE",
      400
    )
  }
}
