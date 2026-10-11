"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

/** Copies a record id. The visible text names what is copied; the id is in the accessible name. */
export function CopyIdButton({ id, noun }: { id: string; noun: string }) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1 px-2 font-mono text-xs"
      aria-label={`Copy ${noun} ID ${id}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          toast({
            title: "Could not copy",
            description: "Clipboard access was denied by the browser.",
            variant: "destructive",
          })
        }
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span aria-hidden="true">{id.slice(0, 8)}</span>
      <span className="sr-only" role="status">
        {copied ? "Copied" : ""}
      </span>
    </Button>
  )
}
