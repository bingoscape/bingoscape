"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { deleteBingo } from "@/app/actions/bingo"
import { toast } from "@/hooks/use-toast"
import { Trash2 } from "lucide-react"
import { type UUID } from "crypto"

interface DeleteBingoButtonProps {
  bingoId: UUID
  /** Controlled open state, for opening the dialog from a menu item. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Render only the confirmation dialog (no trigger button). */
  hideTrigger?: boolean
  /** Called after the Board was deleted. */
  onDeleted?: () => void
}

export function DeleteBingoButton({
  bingoId,
  open,
  onOpenChange,
  hideTrigger = false,
  onDeleted,
}: DeleteBingoButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isDeleteDialogOpen = open ?? internalOpen
  const setIsDeleteDialogOpen = onOpenChange ?? setInternalOpen
  const router = useRouter()

  const handleDeleteBingo = async () => {
    try {
      const result = await deleteBingo(bingoId)
      if (result.success) {
        toast({
          title: "Bingo deleted",
          description: "The bingo has been successfully deleted.",
        })
        onDeleted?.()
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to delete bingo",
          variant: "destructive",
        })
      }
    } catch (_) {
      toast({
        title: "Error",
        description: "Failed to delete bingo",
        variant: "destructive",
      })
    }
    setIsDeleteDialogOpen(false)
  }

  return (
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      {!hideTrigger && (
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete Bingo</span>
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to delete this bingo?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the bingo
            and all its tiles.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteBingo}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
