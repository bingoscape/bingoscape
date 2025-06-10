"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { deleteUser } from "@/app/actions/super-admin"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface User {
  id: string
  name: string | null
  email: string | null
}

interface SuperAdminUserDeleteModalProps {
  user: User
}

export function SuperAdminUserDeleteModal({ user }: SuperAdminUserDeleteModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleDelete = async () => {
    setLoading(true)

    try {
      await deleteUser(user.id)

      toast({
        title: "User deleted",
        description: "User and all associated data has been permanently deleted.",
      })

      setOpen(false)
      router.push("/super-admin/users")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete User
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. This will permanently delete the user account and remove all associated data
              including:
            </AlertDescription>
          </Alert>

          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>User profile and authentication data</li>
            <li>Clan memberships</li>
            <li>Event participations</li>
            <li>Team memberships</li>
            <li>Tile submissions</li>
            <li>Created events (ownership will be removed)</li>
            <li>Owned clans (ownership will be removed)</li>
          </ul>

          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">User to delete:</p>
            <p className="text-sm">
              {user.name ?? "No name"} ({user.email})
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Deleting..." : "Delete User"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
