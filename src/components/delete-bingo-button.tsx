'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { deleteBingo } from "@/app/actions/bingo"
import { toast } from "@/hooks/use-toast"
import { Trash2 } from "lucide-react"
import { type UUID } from "crypto"

interface DeleteBingoButtonProps {
  bingoId: UUID
}

export function DeleteBingoButton({ bingoId }: DeleteBingoButtonProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const router = useRouter()

  const handleDeleteBingo = async () => {
    try {
      await deleteBingo(bingoId)
      toast({
        title: "Bingo deleted",
        description: "The bingo has been successfully deleted.",
      })
      router.refresh()
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
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete Bingo</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this bingo?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the bingo and all its tiles.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteBingo}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
