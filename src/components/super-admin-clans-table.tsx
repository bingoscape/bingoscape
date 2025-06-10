"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ChevronLeft, ChevronRight, Users, Calendar } from "lucide-react"
import Link from "next/link"
import { SuperAdminClanEditModal } from "./super-admin-clan-edit-modal"
import { SuperAdminClanDeleteModal } from "./super-admin-clan-delete-modal"

interface Clan {
  id: string
  name: string
  description: string | null
  ownerId: string | null
  createdAt: Date
  owner: {
    id: string
    name: string | null
    email: string | null
    runescapeName: string | null
  } | null
  memberCount: number
  eventCount: number
}

interface SuperAdminClansTableProps {
  clans: Clan[]
  totalCount: number
  totalPages: number
  currentPage: number
  search: string
}

export function SuperAdminClansTable({
  clans,
  totalCount,
  totalPages,
  currentPage,
  search: initialSearch,
}: SuperAdminClansTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(initialSearch)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    if (search) {
      params.set("search", search)
    } else {
      params.delete("search")
    }
    params.set("page", "1")
    router.push(`/super-admin/clans?${params.toString()}`)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set("page", page.toString())
    router.push(`/super-admin/clans?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clans by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clan</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clans.map((clan) => (
              <TableRow key={clan.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{clan.name}</div>
                    {clan.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1">{clan.description}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {clan.owner ? (
                    <Link href={`/super-admin/users/${clan.owner.id}`} className="hover:underline">
                      <div className="font-medium">{clan.owner.name ?? clan.owner.email}</div>
                      {clan.owner.runescapeName && (
                        <div className="text-sm text-muted-foreground">{clan.owner.runescapeName}</div>
                      )}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">No owner</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{clan.memberCount}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{clan.eventCount}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{new Date(clan.createdAt).toLocaleDateString()}</div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Link href={`/super-admin/clans/${clan.id}`}>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </Link>
                    <SuperAdminClanEditModal clan={clan} />
                    <SuperAdminClanDeleteModal clan={clan} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * 50 + 1} to {Math.min(currentPage * 50, totalCount)} of {totalCount} clans
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
