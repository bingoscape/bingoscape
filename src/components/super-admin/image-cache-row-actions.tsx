"use client"

import { useState } from "react"
import { RefreshCw, Trash2 } from "lucide-react"

import { purgeImage, refreshImage } from "@/app/actions/osrs-image-cache"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { RowActionsMenu, type RowAction } from "./row-actions-menu"

interface ImageCacheRowActionsProps {
  imageKey: string
  /** Refreshing validates a cached copy; for a failed row it retries the fetch. */
  status: "ok" | "not_found" | "error"
}

export function ImageCacheRowActions({
  imageKey,
  status,
}: ImageCacheRowActionsProps) {
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [purging, setPurging] = useState(false)
  const { toast } = useToast()

  const handleRefresh = async () => {
    toast({ title: "Refreshing image", description: imageKey })
    try {
      const result = await refreshImage(imageKey)
      if (!result.success) {
        toast({
          title: "Could not refresh the image",
          description: result.error,
          variant: "destructive",
        })
        return
      }
      const outcome = result.data?.outcome
      toast({
        title:
          outcome === "not_modified"
            ? "Image is up to date"
            : outcome === "replaced"
              ? "Image replaced"
              : "Image fetched",
        description:
          outcome === "not_modified"
            ? "The wiki confirmed the cached copy is current."
            : "Browsers pick up the new image within a day, or on a hard reload.",
      })
    } catch {
      toast({
        title: "Could not refresh the image",
        description: "The request failed. Nothing was changed.",
        variant: "destructive",
      })
    }
  }

  const handlePurge = async () => {
    setPurging(true)
    try {
      const result = await purgeImage(imageKey)
      if (!result.success) {
        toast({
          title: "Could not purge the image",
          description: result.error,
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Image purged",
        description: "The next request fetches it from the wiki again.",
      })
      setPurgeOpen(false)
    } catch {
      toast({
        title: "Could not purge the image",
        description: "The request failed. Nothing was changed.",
        variant: "destructive",
      })
    } finally {
      setPurging(false)
    }
  }

  const actions: RowAction[] = [
    {
      key: "refresh",
      label: status === "ok" ? "Refresh from wiki" : "Retry fetch now",
      icon: RefreshCw,
      onSelect: () => void handleRefresh(),
    },
    {
      key: "purge",
      label: "Purge",
      icon: Trash2,
      onSelect: () => setPurgeOpen(true),
      destructive: true,
    },
  ]

  return (
    <>
      <RowActionsMenu subject={imageKey} actions={actions} />
      <AlertDialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge cached image</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the cached file and its record for{" "}
              <span className="font-mono break-all">{imageKey}</span>. Boards
              and tiles that use it are not touched; the next request fetches
              the image from the wiki again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purging}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={purging}
              onClick={() => void handlePurge()}
            >
              {purging ? "Purging…" : "Purge image"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
