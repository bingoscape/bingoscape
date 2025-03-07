"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { Share2, Copy, ExternalLink } from "lucide-react"

interface ShareEventButtonProps {
  eventId: string
  eventTitle: string
  isPublic: boolean
}

export function ShareEventButton({ eventId, eventTitle, isPublic }: ShareEventButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [publicUrl, setPublicUrl] = useState("")
  const [isMounted, setIsMounted] = useState(false)

  // Only access window after component has mounted in the browser
  useEffect(() => {
    setIsMounted(true)
    if (typeof window !== "undefined") {
      setPublicUrl(`${window.location.origin}/public/events/${eventId}`)
    }
  }, [eventId])

  const handleCopy = () => {
    if (!isMounted) return

    navigator.clipboard
      .writeText(publicUrl)
      .then(() => {
        toast({
          title: "Link copied",
          description: "The public event link has been copied to your clipboard.",
        })
      })
      .catch(() => {
        toast({
          title: "Copy failed",
          description: "Failed to copy the link. Please try again.",
          variant: "destructive",
        })
      })
  }

  const handleVisit = () => {
    if (!isMounted) return

    window.open(publicUrl, "_blank")
    setIsOpen(false)
  }

  // Don't render the button if the event is not public
  if (!isPublic) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Event</DialogTitle>
          <DialogDescription>
            Share a public link to this event. Anyone with this link can view the event details.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm font-medium mb-2">Public link for &quot;{eventTitle}&quot;</p>
          <div className="flex items-center gap-2">
            <Input value={publicUrl} readOnly className="flex-1" />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Note: Only visible bingos will be displayed on the public page.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
          <Button onClick={handleVisit} className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            <span>Visit Public Page</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

