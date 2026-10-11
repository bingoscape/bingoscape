"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { createClan } from "@/app/actions/clan"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/components/responsive-dialog"
import { toast } from "@/hooks/use-toast"

interface CreateClanModalProps {
  className?: string
  size?: "default" | "sm" | "lg"
}

export default function CreateClanModal({
  className,
  size = "default",
}: CreateClanModalProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const router = useRouter()

  const handleOpenChange = (next: boolean) => {
    if (isLoading) return
    // Start from a clean form every time the dialog opens.
    if (next) {
      setName("")
      setDescription("")
    }
    setOpen(next)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const result = await createClan(name, description)
      if (!result.success) {
        throw new Error(result.error)
      }
      setOpen(false)
      toast({
        title: "Clan created",
        description: `${result.clan.name} is ready. Invite your members next.`,
      })
      router.push(`/clans/${result.clan.id}?tab=invites`)
    } catch (error) {
      toast({
        title: "Couldn't create clan",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size={size} className={className}>
          <Plus aria-hidden="true" />
          Create clan
        </Button>
      </DialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a clan</DialogTitle>
          <DialogDescription>
            Create a clan for your OSRS crew. You become its owner and admin.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <ResponsiveDialogBody>
            <div className="space-y-2">
              <Label htmlFor="clan-name">Clan name</Label>
              <Input
                id="clan-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={255}
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clan-description">Description (optional)</Label>
              <Textarea
                id="clan-description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={4}
              />
            </div>
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? "Creating…" : "Create clan"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </Dialog>
  )
}
