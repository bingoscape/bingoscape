"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, ArrowUpDown, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SuperAdminMemberRoleModal } from "./super-admin-member-role-modal"
import { SuperAdminMemberRemoveModal } from "./super-admin-member-remove-modal"
import { formatDistanceToNow } from "date-fns"

interface MemberWithActivity {
  id: string
  userId: string
  user: {
    id: string
    name: string | null
    email: string | null
    runescapeName: string | null
    image: string | null
  }
  role: "admin" | "management" | "member" | "guest"
  joinedAt: Date
  isMain: boolean
  submissionCount: number
  lastSeen: Date | null
}

interface SuperAdminClanMembersTableProps {
  members: MemberWithActivity[]
  clanId: string
  ownerId: string | null
}

type SortKey = "username" | "role" | "joinedAt" | "lastSeen" | "submissions"
type SortDirection = "asc" | "desc"

const roleOrder = {
  admin: 4,
  management: 3,
  member: 2,
  guest: 1,
} as const

function SortableHeader({
  column,
  children,
  onSort
}: {
  column: SortKey
  children: React.ReactNode
  onSort: (key: SortKey) => void
}) {
  return (
    <TableHead>
      <Button variant="ghost" onClick={() => onSort(column)} className="h-8 px-2 hover:bg-muted">
        {children}
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    </TableHead>
  )
}

export function SuperAdminClanMembersTable({ members, clanId, ownerId }: SuperAdminClanMembersTableProps) {
  const [search, setSearch] = useState("")
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "joinedAt",
    direction: "desc",
  })

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20"
      case "management":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "member":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "guest":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
      default:
        return ""
    }
  }

  const adminCount = members.filter((m) => m.role === "admin").length

  const filteredAndSortedMembers = useMemo(() => {
    let filtered = members

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (member) =>
          (member.user.name?.toLowerCase().includes(searchLower) ?? false) ||
          (member.user.email?.toLowerCase().includes(searchLower) ?? false) ||
          (member.user.runescapeName?.toLowerCase().includes(searchLower) ?? false),
      )
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortConfig.key) {
        case "username": {
          const aName = (a.user.name ?? a.user.email) ?? ""
          const bName = (b.user.name ?? b.user.email) ?? ""
          comparison = aName.localeCompare(bName)
          break
        }
        case "role":
          comparison = roleOrder[a.role] - roleOrder[b.role]
          break
        case "joinedAt":
          comparison = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
          break
        case "lastSeen": {
          const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0
          const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0
          comparison = aTime - bTime
          break
        }
        case "submissions":
          comparison = a.submissionCount - b.submissionCount
          break
      }

      return sortConfig.direction === "asc" ? comparison : -comparison
    })

    return sorted
  }, [members, search, sortConfig])

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members by name, email, or RSN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader column="username" onSort={handleSort}>User</SortableHeader>
              <SortableHeader column="role" onSort={handleSort}>Role</SortableHeader>
              <SortableHeader column="joinedAt" onSort={handleSort}>Joined</SortableHeader>
              <SortableHeader column="lastSeen" onSort={handleSort}>Last Seen</SortableHeader>
              <SortableHeader column="submissions" onSort={handleSort}>Submissions</SortableHeader>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No members found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedMembers.map((member) => {
                const isOwner = member.userId === ownerId
                const isLastAdmin = member.role === "admin" && adminCount === 1
                const displayName = member.user.name ?? member.user.email ?? "Unknown"

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.user.image ?? undefined} alt={displayName} />
                          <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{displayName}</div>
                            {isOwner && (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                <Crown className="h-3 w-3 mr-1" />
                                Owner
                              </Badge>
                            )}
                          </div>
                          {member.user.runescapeName && (
                            <div className="text-sm text-muted-foreground">{member.user.runescapeName}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(member.role)}>{member.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{new Date(member.joinedAt).toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {member.lastSeen
                          ? formatDistanceToNow(new Date(member.lastSeen), { addSuffix: true })
                          : "Never"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{member.submissionCount}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <SuperAdminMemberRoleModal
                          member={member}
                          clanId={clanId}
                          isOwner={isOwner}
                          adminCount={adminCount}
                        />
                        <SuperAdminMemberRemoveModal
                          member={member}
                          clanId={clanId}
                          isOwner={isOwner}
                          isLastAdmin={isLastAdmin}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSortedMembers.length} of {members.length} members
      </div>
    </div>
  )
}
