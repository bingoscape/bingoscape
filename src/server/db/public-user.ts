import { users } from "@/server/db/schema"

/**
 * The columns of a user that may leave the server in a response or in props to
 * a client component. A full `users` row carries `username`, `email` and
 * `provider_verified_email`; never select `users` (or
 * `db.query.users.findFirst` without `columns`) for a value that is returned to
 * a client. A test (`public-user.test.ts`) greps the
 * source for the common leaks.
 *
 * - `PublicUser`        the shape
 * - `publicUserSelect`  for `db.select(...)` (also nestable: `{ owner: publicUserSelect }`)
 * - `PUBLIC_USER_COLUMNS` for `db.query.users.findFirst({ columns })`
 */
export interface PublicUser {
  id: string
  name: string | null
  image: string | null
  runescapeName: string | null
}

export const publicUserSelect = {
  id: users.id,
  name: users.name,
  image: users.image,
  runescapeName: users.runescapeName,
} as const

export const PUBLIC_USER_COLUMNS = {
  id: true,
  name: true,
  image: true,
  runescapeName: true,
} as const
