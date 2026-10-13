export type AuthzErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND"

/**
 * Thrown by the authorization guards. Server actions convert it into
 * `{ success: false, error }` via `authzErrorMessage`.
 */
export class AuthzError extends Error {
  constructor(
    message: string,
    readonly code: AuthzErrorCode = "FORBIDDEN"
  ) {
    super(message)
    this.name = "AuthzError"
  }
}

/** Returns the AuthzError message, or the fallback for any other error. */
export function authzErrorMessage(error: unknown, fallback: string): string {
  return error instanceof AuthzError ? error.message : fallback
}
