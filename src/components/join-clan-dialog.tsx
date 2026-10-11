"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ticket } from "lucide-react"

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
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/components/responsive-dialog"
import { parseClanInviteCode } from "@/lib/clan"

interface JoinClanDialogProps {
  className?: string
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
}

/**
 * Invites are the only way into a clan, so this takes a pasted link or bare
 * code and sends the player to the join preview page.
 */
export function JoinClanDialog({
  className,
  variant = "outline",
  size = "default",
}: JoinClanDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setValue("")
      setError(null)
    }
    setOpen(next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = parseClanInviteCode(value)
    if (!code) {
      setError("Paste an invite link or code.")
      return
    }
    setOpen(false)
    router.push(`/clans/join?code=${encodeURIComponent(code)}`)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Ticket aria-hidden="true" />
          Join with invite code
        </Button>
      </DialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join a clan</DialogTitle>
          <DialogDescription>
            Clans are invite-only. Paste the invite link or code a clan manager
            sent you.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <ResponsiveDialogBody>
            <div className="space-y-2">
              <Label htmlFor="clan-invite-input">Invite link or code</Label>
              <Input
                id="clan-invite-input"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="Paste invite link or code"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "clan-invite-error" : undefined}
              />
              {error && (
                <p
                  id="clan-invite-error"
                  role="alert"
                  className="text-danger text-sm"
                >
                  {error}
                </p>
              )}
            </div>
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Continue</Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </Dialog>
  )
}
