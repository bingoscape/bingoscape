"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle,
  XCircle,
  Search,
  Clock,
  MessageSquare,
  User,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
  type RegistrationRequest,
} from "@/app/actions/events"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface RegistrationRequestsTableProps {
  requests: RegistrationRequest[]
  eventId: string
}

export function RegistrationRequestsTable({
  requests: initialRequests,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  eventId,
}: RegistrationRequestsTableProps) {
  const [requests, setRequests] =
    useState<RegistrationRequest[]>(initialRequests)
  const [filter, setFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all")
  const [search, setSearch] = useState("")
  const [selectedRequest, setSelectedRequest] =
    useState<RegistrationRequest | null>(null)
  const [responseMessage, setResponseMessage] = useState("")
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter requests based on status and search term
  const filteredRequests = requests.filter((request) => {
    const matchesFilter = filter === "all" || request.status === filter

    if (!search) return matchesFilter

    const searchLower = search.toLowerCase()
    return (
      matchesFilter &&
      (request.user.name?.toLowerCase().includes(searchLower) ??
        request.user.email?.toLowerCase().includes(searchLower) ??
        request.user.runescapeName?.toLowerCase().includes(searchLower) ??
        request.message?.toLowerCase().includes(searchLower))
    )
  })

  const handleApprove = async () => {
    if (!selectedRequest) return

    setIsSubmitting(true)
    try {
      await approveRegistrationRequest(selectedRequest.id, responseMessage)

      // Update local state
      setRequests((prev) =>
        prev.map((req) =>
          req.id === selectedRequest.id
            ? {
                ...req,
                status: "approved",
                responseMessage: responseMessage || null,
                reviewedAt: new Date(),
              }
            : req
        )
      )

      toast({
        title: "Request approved",
        description: "The registration request has been approved.",
      })

      setSelectedRequest(null)
      setResponseMessage("")
      setActionType(null)
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to approve request",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return

    setIsSubmitting(true)
    try {
      await rejectRegistrationRequest(selectedRequest.id, responseMessage)

      // Update local state
      setRequests((prev) =>
        prev.map((req) =>
          req.id === selectedRequest.id
            ? {
                ...req,
                status: "rejected",
                responseMessage: responseMessage || null,
                reviewedAt: new Date(),
              }
            : req
        )
      )

      toast({
        title: "Request rejected",
        description: "The registration request has been rejected.",
      })

      setSelectedRequest(null)
      setResponseMessage("")
      setActionType(null)
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to reject request",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">
            Pending
          </Badge>
        )
      case "approved":
        return (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            Approved
          </Badge>
        )
      case "rejected":
        return (
          <Badge className="bg-red-500 text-white hover:bg-red-600">
            Rejected
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={filter}
          onValueChange={(value: "all" | "pending" | "approved" | "rejected") =>
            setFilter(value)
          }
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          {search || filter !== "all"
            ? "No registration requests match your filters"
            : "No registration requests found for this event"}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={request.user.image ?? undefined}
                          alt={request.user.name ?? "User"}
                        />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {request.user.name ?? "Anonymous"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {request.user.runescapeName ??
                            request.user.email ??
                            "No contact info"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    {request.message ? (
                      <div className="flex items-center gap-1 text-sm">
                        <MessageSquare className="h-3 w-3" />
                        <span className="max-w-[200px] truncate">
                          {request.message}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No message
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3" />
                      <span>
                        {new Date(request.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {request.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:bg-green-50 hover:text-green-700"
                          onClick={() => {
                            setSelectedRequest(request)
                            setActionType("approve")
                          }}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => {
                            setSelectedRequest(request)
                            setActionType("reject")
                          }}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {request.reviewedAt
                          ? `${request.status === "approved" ? "Approved" : "Rejected"} on ${new Date(request.reviewedAt).toLocaleDateString()}`
                          : `${request.status === "approved" ? "Approved" : "Rejected"}`}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Approval Dialog */}
      <Dialog
        open={actionType === "approve" && !!selectedRequest}
        onOpenChange={() => {
          if (actionType === "approve") {
            setActionType(null)
            setSelectedRequest(null)
            setResponseMessage("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Registration Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this registration request from{" "}
              {selectedRequest?.user.name ?? "this user"}? They will be added as
              a participant to the event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Response Message (Optional)
              </label>
              <Textarea
                placeholder="Add a message to the user about their approval..."
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This message will be visible to the user when they view their
                registration status.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionType(null)
                setSelectedRequest(null)
                setResponseMessage("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {isSubmitting ? "Approving..." : "Approve Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog
        open={actionType === "reject" && !!selectedRequest}
        onOpenChange={() => {
          if (actionType === "reject") {
            setActionType(null)
            setSelectedRequest(null)
            setResponseMessage("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Registration Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this registration request from{" "}
              {selectedRequest?.user.name ?? "this user"}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Reason for Rejection (Recommended)
              </label>
              <Textarea
                placeholder="Explain why this request is being rejected..."
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This message will be visible to the user when they view their
                registration status.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionType(null)
                setSelectedRequest(null)
                setResponseMessage("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isSubmitting}
              variant="destructive"
            >
              {isSubmitting ? "Rejecting..." : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
