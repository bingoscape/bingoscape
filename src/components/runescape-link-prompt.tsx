'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { linkRunescapeAccount } from '@/app/actions/user'

export function RunescapeLinkPrompt() {
  const { data: session, update } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [runescapeName, setRunescapeName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (session?.user && !session.user.runescapeName) {
      setIsOpen(true)
    }
  }, [session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await linkRunescapeAccount(runescapeName)
      await update()
      setIsOpen(false)
      toast({
        title: "Account Linked",
        description: "Your RuneScape account has been successfully linked.",
      })
      router.refresh()
    } catch (_) {
      toast({
        title: "Error",
        description: "Failed to link RuneScape account. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!session?.user) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Your RuneScape Account</DialogTitle>
          <DialogDescription>
            Please enter your RuneScape username to link your account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="runescapeName" className="text-right">
                Username
              </Label>
              <Input
                id="runescapeName"
                value={runescapeName}
                onChange={(e) => setRunescapeName(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Linking..." : "Link Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

