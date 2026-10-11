"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseInviteCode } from "@/lib/invite-code"

interface JoinEventFormProps {
  onNavigate?: () => void
  idPrefix?: string
}

export function JoinEventForm({
  onNavigate,
  idPrefix = "join",
}: JoinEventFormProps) {
  const router = useRouter()
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const inputId = `${idPrefix}-invite`
  const errorId = `${idPrefix}-invite-error`

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = parseInviteCode(value)
    if (!code) {
      setError("Paste an invite link or code.")
      return
    }
    setError(null)
    onNavigate?.()
    router.push(`/events/join/${encodeURIComponent(code)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2" noValidate>
      <Label htmlFor={inputId}>Invite link or code</Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
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
          aria-describedby={error ? errorId : undefined}
        />
        <Button type="submit">Join</Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  )
}
