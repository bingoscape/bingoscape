"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { joinClanWithInvite } from "@/app/actions/clan"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"

interface JoinClanButtonProps {
  inviteCode: string
  className?: string
}

export function JoinClanButton({ inviteCode, className }: JoinClanButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleJoin = async () => {
    setPending(true)
    try {
      const result = await joinClanWithInvite(inviteCode)
      if (result.success) {
        toast({
          title: "Joined clan",
          description: `Welcome to ${result.clanName}.`,
        })
        router.push(`/clans/${result.clanId}`)
        return
      }
      toast({
        title: "Couldn't join clan",
        description: result.error,
        variant: "destructive",
      })
      // The invite may have changed state since the page rendered.
      router.refresh()
    } catch {
      toast({
        title: "Couldn't join clan",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => void handleJoin()}
    >
      {pending ? "Joining…" : "Join clan"}
    </Button>
  )
}
