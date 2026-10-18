/**
 * An error whose message is written for the user and may be sent to the
 * client. Anything else that is thrown (a driver error carries the SQL text
 * and its bound parameters, `DrizzleQueryError` since drizzle-orm 0.44) must
 * be logged on the server and answered with a generic message.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UserFacingError"
  }
}
