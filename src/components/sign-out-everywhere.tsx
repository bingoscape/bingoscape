"use client"

import { useState } from "react"

import { revokeAllSessions } from "@/app/actions/user"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth-client"
import { toast } from "@/hooks/use-toast"

export function SignOutEverywhere() {
  const [pending, setPending] = useState(false)

  const handleClick = async () => {
    setPending(true)
    try {
      const result = await revokeAllSessions()
      if (!result.success) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
        return
      }
      await signOut()
      window.location.assign("/sign-in")
    } catch {
      toast({
        title: "Error",
        description: "Failed to sign out everywhere",
        variant: "destructive",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Sessions</h2>
      <p className="text-muted-foreground text-sm">
        Sign out of every device, including this one. API keys are not affected;
        revoke those on the API keys page.
      </p>
      <Button variant="outline" onClick={handleClick} disabled={pending}>
        {pending ? "Signing out..." : "Sign out everywhere"}
      </Button>
    </div>
  )
}
