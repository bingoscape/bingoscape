'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"
import { Copy, Edit, Trash2, MoreVertical, Check, X, Ban } from "lucide-react"
import { format } from "date-fns"

interface Creator {
  id: string
  name: string | null
  runescapeName: string | null
  image: string | null
}

interface ClanInvite {
  id: string
  clanId: string
  inviteCode: string
  expiresAt: Date | null
  createdAt: Date
  createdBy: string
  label: string | null
  maxUses: number | null
  currentUses: number
  isActive: boolean
  updatedAt: Date
  creator: Creator
}

interface ClanInvitesManagementProps {
  clanId: string
}

export function ClanInvitesManagement({ clanId }: ClanInvitesManagementProps) {
  const [invites, setInvites] = useState<ClanInvite[]>([])
  const [loading, setLoading] = useState(false)
  const [editingInvite, setEditingInvite] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const fetchInvites = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/clans/${clanId}/invites`)
      if (!response.ok) throw new Error('Failed to fetch invites')
      const data = await response.json() as ClanInvite[]
      setInvites(data)
    } catch (error) {
      console.error("Error fetching invites:", error)
      toast({
        title: "Error",
        description: "Failed to load invites",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [clanId])

  useEffect(() => {
    void fetchInvites()
  }, [fetchInvites])

  const copyInviteLink = async (code: string) => {
    const link = `${window.location.origin}/clans/join?code=${code}`
    await navigator.clipboard.writeText(link)
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard",
    })
  }

  const handleRevoke = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/clans/${clanId}/invites/${inviteId}?action=revoke`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to revoke invite')
      toast({
        title: "Success",
        description: "Invite has been revoked",
      })
      await fetchInvites()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to revoke invite",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (inviteId: string) => {
    if (!confirm('Are you sure you want to permanently delete this invite? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/clans/${clanId}/invites/${inviteId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete invite')
      toast({
        title: "Success",
        description: "Invite has been deleted",
      })
      await fetchInvites()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete invite",
        variant: "destructive",
      })
    }
  }

  const startEditingLabel = (invite: ClanInvite) => {
    setEditingInvite(invite.id)
    setEditLabel(invite.label ?? '')
  }

  const cancelEditingLabel = () => {
    setEditingInvite(null)
    setEditLabel('')
  }

  const saveLabel = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/clans/${clanId}/invites/${inviteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editLabel })
      })
      if (!response.ok) throw new Error('Failed to update label')
      toast({
        title: "Success",
        description: "Label updated successfully",
      })
      setEditingInvite(null)
      setEditLabel('')
      await fetchInvites()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update label",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (invite: ClanInvite) => {
    if (!invite.isActive) {
      return <Badge variant="destructive">Revoked</Badge>
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>
    }
    if (invite.maxUses !== null && invite.currentUses >= invite.maxUses) {
      return <Badge variant="secondary">Limit Reached</Badge>
    }
    // Check if expiring soon (within 24 hours)
    if (invite.expiresAt) {
      const hoursUntilExpiry = (new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)
      if (hoursUntilExpiry < 24 && hoursUntilExpiry > 0) {
        return <Badge variant="secondary">Expiring Soon</Badge>
      }
    }
    return <Badge className="bg-green-600">Active</Badge>
  }

  const formatExpiration = (expiresAt: Date | null) => {
    if (!expiresAt) return "Never"
    return format(new Date(expiresAt), "MMM d, yyyy HH:mm")
  }

  const formatUsage = (invite: ClanInvite) => {
    if (invite.maxUses === null) {
      return `${invite.currentUses} / Unlimited`
    }
    return `${invite.currentUses} / ${invite.maxUses}`
  }

  if (loading && invites.length === 0) {
    return <div className="text-center py-8">Loading invites...</div>
  }

  if (invites.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No invites created yet. Use the form above to create your first invite.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Creator</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => (
            <TableRow key={invite.id}>
              {/* Label Cell */}
              <TableCell>
                {editingInvite === invite.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="h-8 w-32"
                      maxLength={100}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveLabel(invite.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEditingLabel}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{invite.label ?? <span className="text-muted-foreground">No label</span>}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => startEditingLabel(invite)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </TableCell>

              {/* Code Cell */}
              <TableCell>
                <code className="text-xs bg-muted px-2 py-1 rounded">{invite.inviteCode}</code>
              </TableCell>

              {/* Creator Cell */}
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={invite.creator.image ?? undefined} />
                    <AvatarFallback>{invite.creator.name?.[0] ?? '?'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{invite.creator.runescapeName ?? invite.creator.name ?? 'Unknown'}</span>
                </div>
              </TableCell>

              {/* Created Cell */}
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(invite.createdAt), "MMM d, yyyy")}
              </TableCell>

              {/* Expires Cell */}
              <TableCell className="text-sm">
                {formatExpiration(invite.expiresAt)}
              </TableCell>

              {/* Usage Cell */}
              <TableCell className="text-sm">
                {formatUsage(invite)}
              </TableCell>

              {/* Status Cell */}
              <TableCell>
                {getStatusBadge(invite)}
              </TableCell>

              {/* Actions Cell */}
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => copyInviteLink(invite.inviteCode)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Link
                    </DropdownMenuItem>
                    {invite.isActive && (
                      <DropdownMenuItem onClick={() => handleRevoke(invite.id)}>
                        <Ban className="mr-2 h-4 w-4" />
                        Revoke
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleDelete(invite.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
