"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

import { refreshAllImages } from "@/app/actions/osrs-image-cache"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const POLL_INTERVAL_MS = 2_000

interface ImageCacheBulkControlsProps {
  /** A bulk refresh is running in this server process. */
  running: boolean
  /** Cached images still waiting for a refresh. */
  stale: number
  /** Cached images in total. */
  cached: number
}

/**
 * Starts / resumes the bulk refresh. While a run is going it re-renders the
 * page every two seconds so the server-rendered progress stays current (the
 * polling is the "continuous updating" exception to the no-client-fetch rule;
 * it only calls `router.refresh()`).
 */
export function ImageCacheBulkControls({
  running,
  stale,
  cached,
}: ImageCacheBulkControlsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => router.refresh(), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [running, router])

  const start = async (resume: boolean) => {
    setPending(true)
    try {
      const result = await refreshAllImages(resume)
      if (!result.success) {
        toast({
          title: "Could not start the bulk refresh",
          description: result.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title: resume ? "Bulk refresh resumed" : "Bulk refresh started",
        description: "About one image per second; progress shows on this page.",
      })
      router.refresh()
    } catch {
      toast({
        title: "Could not start the bulk refresh",
        description: "The request failed. Nothing was changed.",
        variant: "destructive",
      })
    } finally {
      setPending(false)
    }
  }

  const busy = pending || running
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        disabled={busy || cached === 0}
        onClick={() => void start(false)}
      >
        <RefreshCw aria-hidden="true" />
        Refresh all
      </Button>
      {stale > 0 ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void start(true)}
        >
          Resume ({stale.toLocaleString("en-GB")} waiting)
        </Button>
      ) : null}
    </div>
  )
}
