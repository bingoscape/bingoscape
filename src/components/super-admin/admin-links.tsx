import Link from "next/link"

import { userLabel, type UserRef } from "@/lib/super-admin-format"
import { cn } from "@/lib/utils"

const LINK_CLASS =
  "rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"

export function UserLink({
  user,
  className,
}: {
  user: UserRef
  className?: string
}) {
  return (
    <Link
      href={`/super-admin/users/${user.id}`}
      className={cn(LINK_CLASS, className)}
    >
      {userLabel(user)}
    </Link>
  )
}

export function ClanLink({
  clan,
  className,
}: {
  clan: { id: string; name: string }
  className?: string
}) {
  return (
    <Link
      href={`/super-admin/clans/${clan.id}`}
      className={cn(LINK_CLASS, className)}
    >
      {clan.name}
    </Link>
  )
}

export function EventLink({
  event,
  className,
}: {
  event: { id: string; title: string }
  className?: string
}) {
  return (
    <Link
      href={`/super-admin/events/${event.id}`}
      className={cn(LINK_CLASS, className)}
    >
      {event.title}
    </Link>
  )
}
