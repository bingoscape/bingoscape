"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, ChevronLeft, ChevronRight, Users, Shield } from "lucide-react"
import Link from "next/link"
import { SuperAdminEventEditModal } from "./super-admin-event-edit-modal"
import { SuperAdminEventDeleteModal } from "./super-admin-event-delete-modal"

interface Event {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  createdAt: Date
  locked: boolean
  public: boolean
  creator: {
    id: string
    name: string | null
    email: string | null
    runescapeName: string | null
  } | null
  clan: {
    id: string
    name: string
  } | null
  participantCount: number
}

interface SuperAdminEventsTableProps {
  events: Event[]
  totalCount: number
  totalPages: number
  currentPage: number
  search: string
}

export function SuperAdminEventsTable({
  events,
  totalCount,
  totalPages,
  currentPage,
  search: initialSearch,
}: SuperAdminEventsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(initialSearch)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams ?? '')
    if (search) {
      params.set("search", search)
    } else {
      params.delete("search")
    }
    params.set("page", "1")
    router.push(`/super-admin/events?${params.toString()}`)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams ?? '')
    params.set("page", page.toString())
    router.push(`/super-admin/events?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events by title or description..."
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
              <TableHead>Event</TableHead>
              <TableHead>Creator</TableHead>
              <TableHead>Clan</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{event.title}</div>
                    {event.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1">{event.description}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {event.creator ? (
                    <Link href={`/super-admin/users/${event.creator.id}`} className="hover:underline">
                      <div className="font-medium">{event.creator.name ?? event.creator.email}</div>
                      {event.creator.runescapeName && (
                        <div className="text-sm text-muted-foreground">{event.creator.runescapeName}</div>
                      )}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">No creator</span>
                  )}
                </TableCell>
                <TableCell>
                  {event.clan ? (
                    <Link
                      href={`/super-admin/clans/${event.clan.id}`}
                      className="hover:underline flex items-center gap-1"
                    >
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      {event.clan.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">No clan</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{event.participantCount}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Badge variant={event.locked ? "destructive" : "default"}>
                      {event.locked ? "Locked" : "Open"}
                    </Badge>
                    <Badge variant={event.public ? "default" : "secondary"}>
                      {event.public ? "Public" : "Private"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>{new Date(event.startDate).toLocaleDateString()}</div>
                    <div className="text-muted-foreground">to {new Date(event.endDate).toLocaleDateString()}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Link href={`/super-admin/events/${event.id}`}>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </Link>
                    <SuperAdminEventEditModal event={event} />
                    <SuperAdminEventDeleteModal event={event} />
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
            Showing {(currentPage - 1) * 50 + 1} to {Math.min(currentPage * 50, totalCount)} of {totalCount} events
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
