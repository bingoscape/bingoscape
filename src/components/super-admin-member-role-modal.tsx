"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateClanMemberRole } from "@/app/actions/super-admin"
import { useToast } from "@/hooks/use-toast"
import { Shield, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

interface MemberWithUser {
  id: string
  userId: string
  role: "admin" | "management" | "member" | "guest"
  user: {
    id: string
    name: string | null
    email: string | null
    runescapeName: string | null
  }
}

interface SuperAdminMemberRoleModalProps {
  member: MemberWithUser
  clanId: string
  isOwner: boolean
  adminCount: number
}

export function SuperAdminMemberRoleModal({ member, clanId, isOwner, adminCount }: SuperAdminMemberRoleModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newRole, setNewRole] = useState<"admin" | "management" | "member" | "guest">(member.role)
  const { toast } = useToast()

  const displayName = member.user.name ?? member.user.email ?? "Unknown User"
  const isLastAdmin = member.role === "admin" && adminCount === 1
  const roleChanged = newRole !== member.role

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!roleChanged) {
      toast({
        title: "No changes",
        description: "Please select a different role.",
        variant: "destructive",
      })
      return
    }

    if (isOwner) {
      toast({
        title: "Cannot change owner role",
        description: "Please transfer ownership first using the Edit Clan modal.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      await updateClanMemberRole(clanId, member.userId, newRole)

      toast({
        title: "Role updated",
        description: `${displayName}&apos;s role has been changed to ${newRole}.`,
      })

      setOpen(false)
    } catch {
      toast({
        title: "Error",
        description: "Failed to update member role. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Shield className="h-4 w-4 mr-2" />
          Change Role
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Member Role</DialogTitle>
          <DialogDescription>
            Update the role for {displayName}
            {member.user.runescapeName && ` (${member.user.runescapeName})`}
          </DialogDescription>
        </DialogHeader>

        {isOwner && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Cannot change clan owner&apos;s role. Transfer ownership first using the Edit Clan modal.
            </AlertDescription>
          </Alert>
        )}

        {isLastAdmin && newRole !== "admin" && !isOwner && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              This is the last admin in the clan. Proceeding will leave the clan without any admins.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Current Role</Label>
            <div className="mt-2">
              <Badge className={getRoleBadgeColor(member.role)}>{member.role}</Badge>
            </div>
          </div>

          <div>
            <Label htmlFor="role">New Role</Label>
            <Select value={newRole} onValueChange={(value) => setNewRole(value as typeof newRole)} disabled={isOwner}>
              <SelectTrigger id="role" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <span>Admin</span>
                    <span className="text-xs text-muted-foreground">(Full control)</span>
                  </div>
                </SelectItem>
                <SelectItem value="management">
                  <div className="flex items-center gap-2">
                    <span>Management</span>
                    <span className="text-xs text-muted-foreground">(Can manage members)</span>
                  </div>
                </SelectItem>
                <SelectItem value="member">
                  <div className="flex items-center gap-2">
                    <span>Member</span>
                    <span className="text-xs text-muted-foreground">(Regular member)</span>
                  </div>
                </SelectItem>
                <SelectItem value="guest">
                  <div className="flex items-center gap-2">
                    <span>Guest</span>
                    <span className="text-xs text-muted-foreground">(Observer only)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {roleChanged && !isOwner && (
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium">Confirm Change:</p>
              <p className="text-muted-foreground mt-1">
                Change {displayName}&apos;s role from <span className="font-medium">{member.role}</span> to{" "}
                <span className="font-medium">{newRole}</span>
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !roleChanged || isOwner}>
              {loading ? "Updating..." : "Update Role"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
