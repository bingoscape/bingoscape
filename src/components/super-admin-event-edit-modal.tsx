"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateEvent, getAllClansForDropdown } from "@/app/actions/super-admin"
import { useToast } from "@/hooks/use-toast"
import { Edit } from "lucide-react"

interface Event {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  locked: boolean
  public: boolean
  clan: { id: string; name: string } | null
}

interface SuperAdminEventEditModalProps {
  event: Event
}

export function SuperAdminEventEditModal({ event }: SuperAdminEventEditModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clans, setClans] = useState<Array<{ id: string; name: string }>>([])
  const [formData, setFormData] = useState({
    title: event.title,
    description: event.description ?? "",
    startDate: new Date(event.startDate).toISOString().slice(0, 16),
    endDate: new Date(event.endDate).toISOString().slice(0, 16),
    locked: event.locked,
    public: event.public,
    clanId: event.clan?.id ?? "none",
  })
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      getAllClansForDropdown().then(setClans).catch((error) => { console.error("Failed to fetch clans:", error) })
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await updateEvent(event.id, {
        title: formData.title,
        description: formData.description || null,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        locked: formData.locked,
        public: formData.public,
        clanId: formData.clanId === "none" ? null : formData.clanId,
      })

      toast({
        title: "Event updated",
        description: "Event information has been successfully updated.",
      })

      setOpen(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update event. Please try again.",
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
          <Edit className="h-4 w-4 mr-2" />
          Edit Event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Event title"
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Event description"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="clan">Clan</Label>
            <Select value={formData.clanId} onValueChange={(value) => setFormData({ ...formData, clanId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select clan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No clan</SelectItem>
                {clans.map((clan) => (
                  <SelectItem key={clan.id} value={clan.id}>
                    {clan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="locked"
              checked={formData.locked}
              onCheckedChange={(checked) => setFormData({ ...formData, locked: checked })}
            />
            <Label htmlFor="locked">Event Locked</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="public"
              checked={formData.public}
              onCheckedChange={(checked) => setFormData({ ...formData, public: checked })}
            />
            <Label htmlFor="public">Public Event</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
