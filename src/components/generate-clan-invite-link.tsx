"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Link2 } from "lucide-react"

import { createClanInvite } from "@/app/actions/clan"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { MAX_INVITE_LABEL_LENGTH, buildClanInviteUrl } from "@/lib/clan"

const EXPIRY_OPTIONS = [
  { value: "0", label: "Never" },
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "custom", label: "Custom…" },
]

const USES_OPTIONS = [
  { value: "0", label: "Unlimited" },
  { value: "1", label: "Single use" },
  { value: "10", label: "10 uses" },
  { value: "25", label: "25 uses" },
  { value: "custom", label: "Custom…" },
]

/** `null` means "no limit"; `undefined` means the custom value is invalid. */
function resolveLimit(
  choice: string,
  custom: string,
  max: number
): number | null | undefined {
  if (choice === "0") return null
  const raw = choice === "custom" ? custom : choice
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= max ? n : undefined
}

export function GenerateClanInviteLink({ clanId }: { clanId: string }) {
  const router = useRouter()
  const [label, setLabel] = useState("")
  const [expiry, setExpiry] = useState("0")
  const [customDays, setCustomDays] = useState("")
  const [uses, setUses] = useState("0")
  const [customUses, setCustomUses] = useState("")
  const [pending, setPending] = useState(false)
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast({ title: "Copied", description: "Invite link copied to clipboard." })
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Select the link and copy it manually.",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const expiresInDays = resolveLimit(expiry, customDays, 365)
    const maxUses = resolveLimit(uses, customUses, 10000)
    if (expiresInDays === undefined) {
      toast({
        title: "Check the expiry",
        description: "Enter a whole number of days from 1 to 365.",
        variant: "destructive",
      })
      return
    }
    if (maxUses === undefined) {
      toast({
        title: "Check the usage limit",
        description: "Enter a whole number from 1 to 10,000.",
        variant: "destructive",
      })
      return
    }

    setPending(true)
    try {
      const result = await createClanInvite({
        clanId,
        label: label.trim() || undefined,
        expiresInDays,
        maxUses,
      })
      if (!result.success) {
        toast({
          title: "Couldn't create invite",
          description: result.error,
          variant: "destructive",
        })
        return
      }
      setCreatedLink(
        buildClanInviteUrl(window.location.origin, result.invite.inviteCode)
      )
      setCopied(false)
      setLabel("")
      router.refresh()
      toast({ title: "Invite created" })
    } catch {
      toast({
        title: "Couldn't create invite",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="invite-label">Label (optional)</Label>
            <Input
              id="invite-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Discord recruitment"
              maxLength={MAX_INVITE_LABEL_LENGTH}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-expiry">Expires</Label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger id="invite-expiry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {expiry === "custom" && (
              <Input
                aria-label="Custom expiry in days"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                placeholder="Days (1-365)"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-uses">Usage limit</Label>
            <Select value={uses} onValueChange={setUses}>
              <SelectTrigger id="invite-uses">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USES_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {uses === "custom" && (
              <Input
                aria-label="Custom usage limit"
                type="number"
                inputMode="numeric"
                min={1}
                max={10000}
                placeholder="Uses (1-10000)"
                value={customUses}
                onChange={(e) => setCustomUses(e.target.value)}
              />
            )}
          </div>
        </div>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          <Link2 aria-hidden="true" />
          {pending ? "Creating…" : "Create invite link"}
        </Button>
      </form>

      {createdLink && (
        <div
          role="status"
          className="osrs-slot flex flex-col gap-2 rounded-sm p-3 sm:flex-row sm:items-center"
        >
          <Label htmlFor="invite-created-link" className="sr-only">
            New invite link
          </Label>
          <Input
            id="invite-created-link"
            readOnly
            value={createdLink}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            type="button"
            onClick={() => void copy(createdLink)}
            className="w-full sm:w-auto"
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
    </div>
  )
}
