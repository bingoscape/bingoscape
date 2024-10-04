'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { type GenerateInviteResponse } from '@/app/api/clans/[clanId]/invite/route'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Link } from "lucide-react"

export function GenerateClanInviteLink({ clanId }: { clanId: string }) {
  const [inviteLink, setInviteLink] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const generateInvite = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/clans/${clanId}/invite`, {
        method: 'POST',
      })
      const data = await response.json() as GenerateInviteResponse;
      if (response.ok) {
        const link = `${window.location.origin}/clans/join?code=${data.inviteCode}`
        setInviteLink(link)
        toast({
          title: "Invite link generated",
          description: "The invite link has been created successfully.",
        })
      } else {
        throw new Error("Failed to generate invite link")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate invite link. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(inviteLink)
    toast({
      title: "Copied to clipboard",
      description: "The invite link has been copied to your clipboard.",
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Link className="mr-2 h-4 w-4" />
          Generate Invite Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate Clan Invite Link</DialogTitle>
          <DialogDescription>
            Create an invite link for this clan. The link can be shared with others to join the clan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Button onClick={generateInvite} disabled={isLoading} className="w-full">
            {isLoading ? "Generating..." : "Generate Invite Link"}
          </Button>
          {inviteLink && (
            <div className="flex space-x-2">
              <Input value={inviteLink} readOnly />
              <Button onClick={copyToClipboard}>Copy</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
