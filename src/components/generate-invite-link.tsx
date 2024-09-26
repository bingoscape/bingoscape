'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"

export function GenerateInviteLink({ clanId }: { clanId: string }) {
  const [inviteLink, setInviteLink] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const generateInvite = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/clans/${clanId}/invite`, {
        method: 'POST',
      })
      const data = await response.json()
      if (response.ok) {
        const link = `${window.location.origin}/clans/join?code=${data.inviteCode}`
        setInviteLink(link)
        toast({
          title: "Invite link generated",
          description: "The invite link has been created successfully.",
        })
      } else {
        throw new Error(data.error)
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink)
    toast({
      title: "Copied to clipboard",
      description: "The invite link has been copied to your clipboard.",
    })
  }

  return (
    <div className="space-y-4">
      <Button onClick={generateInvite} disabled={isLoading}>
        {isLoading ? "Generating..." : "Generate Invite Link"}
      </Button>
      {inviteLink && (
        <div className="flex space-x-2">
          <Input value={inviteLink} readOnly />
          <Button onClick={copyToClipboard}>Copy</Button>
        </div>
      )}
    </div>
  )
}

