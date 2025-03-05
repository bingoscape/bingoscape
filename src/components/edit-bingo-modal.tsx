"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { updateBingo } from "@/app/actions/bingo"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Edit } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface Bingo {
  id: string
  title: string
  description: string | null
  visible: boolean
  locked: boolean
  codephrase: string
}

export function EditBingoModal({ bingo }: { bingo: Bingo }) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: bingo.title,
    description: bingo.description ?? "",
    visible: bingo.visible,
    locked: bingo.locked,
    codephrase: bingo.codephrase,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await updateBingo(bingo.id, formData)
      if (result.success) {
        toast({
          title: "Success",
          description: "Bingo updated successfully",
        })
        setIsOpen(false)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error(error)
      toast({
        title: "Error",
        description: "Failed to update bingo",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Bingo</DialogTitle>
          <DialogDescription>Make changes to your bingo here. Click save when you are done.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" value={formData.title} onChange={handleChange} placeholder="Bingo Title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Bingo Description"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="codephrase">Codephrase</Label>
            <Input
              id="codephrase"
              name="codephrase"
              value={formData.codephrase}
              onChange={handleChange}
              placeholder="Codephrase"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="visible">Visible to Participants</Label>
            <Switch
              id="visible"
              checked={formData.visible}
              onCheckedChange={(checked) => handleSwitchChange("visible", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="locked">Locked (Prevent Submissions)</Label>
            <Switch
              id="locked"
              checked={formData.locked}
              onCheckedChange={(checked) => handleSwitchChange("locked", checked)}
            />
          </div>
          <Button type="submit">Save Changes</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
