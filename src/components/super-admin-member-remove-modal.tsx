"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { removeClanMember } from "@/app/actions/super-admin"
import { useToast } from "@/hooks/use-toast"
import { UserMinus, AlertTriangle, XCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

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

interface SuperAdminMemberRemoveModalProps {
  member: MemberWithUser
  clanId: string
  isOwner: boolean
  isLastAdmin: boolean
}

export function SuperAdminMemberRemoveModal({ member, clanId, isOwner, isLastAdmin }: SuperAdminMemberRemoveModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const { toast } = useToast()

  const displayName = member.user.name ?? member.user.email ?? "Unknown User"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isOwner) {
      toast({
        title: "Cannot remove owner",
        description: "The clan owner cannot be removed. Transfer ownership first.",
        variant: "destructive",
      })
      return
    }

    if (!confirmed) {
      toast({
        title: "Confirmation required",
        description: "Please confirm that you want to remove this member.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      await removeClanMember(clanId, member.userId)

      toast({
        title: "Member removed",
        description: `${displayName} has been removed from the clan.`,
      })

      setOpen(false)
      setConfirmed(false)
    } catch {
      toast({
        title: "Error",
        description: "Failed to remove member. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) {
        setConfirmed(false)
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isOwner}>
          <UserMinus className="h-4 w-4 mr-2" />
          Remove
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Remove Member
          </DialogTitle>
          <DialogDescription>
            Remove {displayName}
            {member.user.runescapeName && ` (${member.user.runescapeName})`} from the clan
          </DialogDescription>
        </DialogHeader>

        {isOwner ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              The clan owner cannot be removed from the clan. You must transfer ownership to another member first using the Edit Clan modal.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {isLastAdmin && (
              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <AlertDescription className="text-orange-700 dark:text-orange-300">
                  Warning: This is the last admin in the clan. Removing them will leave the clan without any administrators.
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="font-medium text-destructive mb-2">This action will:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span>Remove {displayName} from all clan events</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span>Revoke their access to clan bingo boards</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span>Remove them from clan team memberships</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span>This action cannot be undone</span>
                </li>
              </ul>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-start gap-2">
                <Checkbox id="confirm" checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
                <Label htmlFor="confirm" className="text-sm font-normal cursor-pointer">
                  I understand this will permanently remove {displayName} from the clan
                </Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={loading || !confirmed || isOwner}>
                  {loading ? "Removing..." : "Remove Member"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
