"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateClan, getAllUsersForDropdown } from "@/app/actions/super-admin"
import { useToast } from "@/hooks/use-toast"
import { Edit } from "lucide-react"

interface Clan {
  id: string
  name: string
  description: string | null
  ownerId: string | null
}

interface SuperAdminClanEditModalProps {
  clan: Clan
}

export function SuperAdminClanEditModal({
  clan,
}: SuperAdminClanEditModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<
    Array<{
      id: string
      name: string | null
      email: string | null
      runescapeName: string | null
    }>
  >([])
  const [formData, setFormData] = useState({
    name: clan.name,
    description: clan.description ?? "",
    ownerId: clan.ownerId ?? "defaultOwnerId",
  })
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      getAllUsersForDropdown()
        .then(setUsers)
        .catch((error) => {
          console.error("Failed to fetch users:", error)
        })
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await updateClan(clan.id, {
        name: formData.name,
        description: formData.description || null,
        ownerId: formData.ownerId || null,
      })

      toast({
        title: "Clan updated",
        description: "Clan information has been successfully updated.",
      })

      setOpen(false)
    } catch (error) {
      console.error("Failed to update clan:", error)
      toast({
        title: "Error",
        description: "Failed to update clan. Please try again.",
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
          <Edit className="mr-2 h-4 w-4" />
          Edit Clan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Clan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Clan Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Clan name"
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Clan description"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="owner">Owner</Label>
            <Select
              value={formData.ownerId}
              onValueChange={(value) =>
                setFormData({ ...formData, ownerId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="defaultOwnerId">No owner</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name ?? user.email}{" "}
                    {user.runescapeName && `(${user.runescapeName})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Clan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
