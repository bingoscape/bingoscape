"use client"

import { useState, useSyncExternalStore } from "react"
import { Clipboard, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"

interface ShareRecapImageProps {
  eventId: string
}

const noSubscription = () => () => undefined
// Clipboard images are not available everywhere (Firefox, insecure origins).
const supportsImageCopy = () =>
  typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write

/**
 * "Share as image": the final rosters as a PNG to download or copy, for
 * pasting into Discord. The picture is drawn by `api/events/[id]/draft/recap-image`.
 */
export function ShareRecapImage({ eventId }: ShareRecapImageProps) {
  const [busy, setBusy] = useState(false)
  const url = `/api/events/${eventId}/draft/recap-image`
  // False on the server and while hydrating, so the markup matches; the
  // client then shows the button where the browser can copy an image.
  const canCopy = useSyncExternalStore(
    noSubscription,
    supportsImageCopy,
    () => false
  )

  const copy = async () => {
    setBusy(true)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error("The image could not be created")
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || "image/png"]: blob }),
      ])
      toast({ title: "Image copied. Paste it into Discord." })
    } catch {
      toast({
        title: "The image could not be copied. Use Download instead.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm" className="gap-2">
        <a href={`${url}?download=1`} download="team-draft.png">
          <Download className="h-4 w-4" aria-hidden="true" />
          Share as image
        </a>
      </Button>
      {canCopy && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={busy}
          onClick={() => void copy()}
        >
          <Clipboard className="h-4 w-4" aria-hidden="true" />
          Copy image
        </Button>
      )}
    </div>
  )
}
