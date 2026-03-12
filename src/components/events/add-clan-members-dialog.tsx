"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "@/hooks/use-toast"
import { Loader2, Search, Crown, Shield, User, Users } from "lucide-react"
import { getClanMembersForEvent } from "@/app/actions/clan"
import { addClanMembersToEvent } from "@/app/actions/events"

interface ClanMember {
  id: string
  name: string | null
  runescapeName: string | null
  image: string | null
  role: "admin" | "management" | "member" | "guest"
}

interface AddClanMembersDialogProps {
  eventId: string
  clanId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddClanMembersDialog({
  eventId,
  clanId,
  open,
  onOpenChange,
  onSuccess,
}: AddClanMembersDialogProps) {
  const [members, setMembers] = useState<ClanMember[]>([])
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open && clanId) {
      loadMembers()
    } else {
      // Reset state when dialog closes
      setMembers([])
      setSelectedMembers(new Set())
      setSearchTerm("")
    }
  }, [open, eventId])

  const loadMembers = async () => {
    setIsLoading(true)
    try {
      const availableMembers = await getClanMembersForEvent(eventId)
      setMembers(availableMembers)
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load clan members",
        variant: "destructive",
      })
      onOpenChange(false)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredMembers = useMemo(() => {
    if (!searchTerm) return members

    const search = searchTerm.toLowerCase()
    return members.filter(
      (m) =>
        m.name?.toLowerCase().includes(search) ||
        m.runescapeName?.toLowerCase().includes(search)
    )
  }, [members, searchTerm])

  const handleToggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers)
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId)
    } else {
      newSelected.add(memberId)
    }
    setSelectedMembers(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set())
    } else {
      setSelectedMembers(new Set(filteredMembers.map((m) => m.id)))
    }
  }

  const handleSubmit = async () => {
    if (selectedMembers.size === 0) {
      toast({
        title: "No members selected",
        description: "Please select at least one clan member to add",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await addClanMembersToEvent(
        eventId,
        Array.from(selectedMembers)
      )

      if (result.success) {
        let description = `Added ${result.added} clan ${result.added === 1 ? "member" : "members"} to event`

        if (result.skipped && result.skipped > 0) {
          description += `. Skipped ${result.skipped} (already ${result.skipped === 1 ? "participant" : "participants"})`
          if (result.skippedUsers && result.skippedUsers.length > 0) {
            description += `: ${result.skippedUsers.join(", ")}`
          }
        }

        toast({
          title: "Success",
          description,
        })

        onSuccess?.()
        onOpenChange(false)
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to add clan members",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add clan members",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Crown className="h-3 w-3" />
      case "management":
        return <Shield className="h-3 w-3" />
      default:
        return <User className="h-3 w-3" />
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default"
      case "management":
        return "secondary"
      default:
        return "outline"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Add Clan Members</DialogTitle>
          <DialogDescription>
            Select clan members to add as participants to this event
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
          {/* Search and Select All */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Search clan members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={isLoading || filteredMembers.length === 0}
            >
              {selectedMembers.size === filteredMembers.length &&
              filteredMembers.length > 0
                ? "Deselect All"
                : "Select All"}
            </Button>
          </div>

          {/* Selected count */}
          {selectedMembers.size > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedMembers.size}{" "}
              {selectedMembers.size === 1 ? "member" : "members"} selected
            </div>
          )}

          {/* Members List */}
          <div className="flex-1 overflow-y-auto rounded-lg border">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                <Users className="mb-2 h-8 w-8" />
                <p className="text-sm">
                  All clan members are already participants
                </p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                <Search className="mb-2 h-8 w-8" />
                <p className="text-sm">
                  No members found matching &quot;{searchTerm}&quot;
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/50"
                    onClick={() => handleToggleMember(member.id)}
                  >
                    <Checkbox
                      checked={selectedMembers.has(member.id)}
                      onCheckedChange={() => handleToggleMember(member.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={member.image ?? undefined}
                        alt={member.name ?? "User"}
                      />
                      <AvatarFallback>{member.name?.[0] ?? "?"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {member.runescapeName ?? member.name}
                      </div>
                      {member.runescapeName && member.name && (
                        <div className="truncate text-sm text-muted-foreground">
                          {member.name}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={getRoleBadgeVariant(member.role)}
                      className="flex flex-shrink-0 items-center gap-1"
                    >
                      {getRoleIcon(member.role)}
                      {member.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedMembers.size === 0}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {selectedMembers.size > 0 ? `${selectedMembers.size} ` : ""}
            {selectedMembers.size === 1 ? "Member" : "Members"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
