"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { deleteClan } from "@/app/actions/super-admin"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Clan {
  id: string
  name: string
}

interface SuperAdminClanDeleteModalProps {
  clan: Clan
}

export function SuperAdminClanDeleteModal({ clan }: SuperAdminClanDeleteModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleDelete = async () => {
    setLoading(true)

    try {
      await deleteClan(clan.id)

      toast({
        title: "Clan deleted",
        description: "Clan and all associated data has been permanently deleted.",
      })

      setOpen(false)
      router.push("/super-admin/clans")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete clan. Please try again.",
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
          Delete Clan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Clan
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. This will permanently delete the clan and:
            </AlertDescription>
          </Alert>

          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Remove all clan members</li>
            <li>Unassign all clan events (events will remain but without clan association)</li>
            <li>Delete all clan-related data</li>
          </ul>

          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">Clan to delete:</p>
            <p className="text-sm">{clan.name}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Deleting..." : "Delete Clan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
