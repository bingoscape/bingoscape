"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Crown, Shield, ShieldCheck, User, UserRound } from "lucide-react"

import { updateMemberRole } from "@/app/actions/clan"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import {
  CLAN_ROLES,
  CLAN_ROLE_LABELS,
  canChangeRoles,
  type ClanRole,
} from "@/lib/clan"
import type { LucideIcon } from "lucide-react"

export interface ClanMemberListMember {
  id: string
  name: string | null
  runescapeName: string | null
  image: string | null
  role: ClanRole
}

interface ClanMemberListProps {
  clanId: string
  members: ClanMemberListMember[]
  viewerId: string
  viewerRole: ClanRole
  ownerId: string | null
}

const ROLE_STYLE: Record<
  ClanRole,
  { variant: BadgeProps["variant"]; icon: LucideIcon }
> = {
  admin: { variant: "info", icon: ShieldCheck },
  management: { variant: "default", icon: Shield },
  member: { variant: "secondary", icon: User },
  guest: { variant: "outline", icon: UserRound },
}

export function RoleBadge({ role }: { role: ClanRole }) {
  const { variant, icon: Icon } = ROLE_STYLE[role]
  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" className="size-3" />
      {CLAN_ROLE_LABELS[role]}
    </Badge>
  )
}

const displayName = (m: ClanMemberListMember) =>
  m.runescapeName ?? m.name ?? "Unknown player"

/**
 * Cards below `lg`, a table from `lg`. Only admins get role controls, and
 * never on their own row or the clan owner's (the server enforces the same).
 */
export function ClanMemberList({
  clanId,
  members,
  viewerId,
  viewerRole,
  ownerId,
}: ClanMemberListProps) {
  const router = useRouter()
  const [change, setChange] = useState<{
    member: ClanMemberListMember
    role: ClanRole
  } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const viewerIsAdmin = canChangeRoles(viewerRole)
  const canEdit = (m: ClanMemberListMember) =>
    viewerIsAdmin && m.id !== viewerId && m.id !== ownerId

  const requestChange = (member: ClanMemberListMember, role: ClanRole) => {
    if (role === member.role) return
    setChange({ member, role })
    setConfirmOpen(true)
  }

  const applyChange = async () => {
    if (!change) return
    try {
      const result = await updateMemberRole(
        clanId,
        change.member.id,
        change.role
      )
      if (!result.success) {
        toast({
          title: "Couldn't change role",
          description: result.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Role updated",
        description: `${displayName(change.member)} is now ${CLAN_ROLE_LABELS[change.role]}.`,
      })
      router.refresh()
    } catch {
      toast({
        title: "Couldn't change role",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
    }
  }

  const markers = (m: ClanMemberListMember) => (
    <>
      {m.id === ownerId && (
        <Badge variant="warning">
          <Crown aria-hidden="true" className="size-3" />
          Owner
        </Badge>
      )}
      {m.id === viewerId && <Badge variant="outline">You</Badge>}
    </>
  )

  const roleSelect = (m: ClanMemberListMember, className?: string) => (
    <Select
      value={m.role}
      onValueChange={(value) => requestChange(m, value as ClanRole)}
    >
      <SelectTrigger
        aria-label={`Role for ${displayName(m)}`}
        className={className}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CLAN_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {CLAN_ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const identity = (m: ClanMemberListMember) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-10">
        <AvatarImage src={m.image ?? undefined} alt="" />
        <AvatarFallback>
          {displayName(m).slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium">{displayName(m)}</p>
        {m.runescapeName && m.name && m.name !== m.runescapeName && (
          <p className="truncate text-sm text-muted-foreground">{m.name}</p>
        )}
      </div>
    </div>
  )

  return (
    <>
      <ul role="list" aria-label="Clan members" className="space-y-2 lg:hidden">
        {members.map((m) => (
          <li
            key={m.id}
            className="osrs-panel flex flex-col gap-3 rounded-sm p-3 sm:p-4"
          >
            {identity(m)}
            <div className="flex flex-wrap items-center gap-1.5">
              <RoleBadge role={m.role} />
              {markers(m)}
            </div>
            {canEdit(m) && roleSelect(m)}
          </li>
        ))}
      </ul>

      <div className="osrs-panel hidden rounded-sm p-2 lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Role</TableHead>
              {viewerIsAdmin && (
                <TableHead className="w-48">Change role</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{identity(m)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <RoleBadge role={m.role} />
                    {markers(m)}
                  </div>
                </TableCell>
                {viewerIsAdmin && (
                  <TableCell>{canEdit(m) && roleSelect(m)}</TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Change role?"
        description={
          change ? (
            <>
              {displayName(change.member)} will go from{" "}
              <strong>{CLAN_ROLE_LABELS[change.member.role]}</strong> to{" "}
              <strong>{CLAN_ROLE_LABELS[change.role]}</strong>.
              {change.role === "admin"
                ? " Admins can change everyone's roles."
                : ""}
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Change role"
        pendingLabel="Updating…"
        onConfirm={applyChange}
      />
    </>
  )
}
