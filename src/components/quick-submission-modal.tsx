"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import type { Tile, Team, Bingo } from "@/app/actions/events"
import { TileSelectionDropdown } from "@/components/tile-selection-dropdown"
import { SubmissionUploadForm } from "@/components/submission-upload-form"
import { toast } from "@/hooks/use-toast"

interface QuickSubmissionModalProps {
  isOpen: boolean
  onClose: () => void
  bingo: Bingo
  currentTeamId: string
  currentTeam: Team | undefined
  unlockedTiers?: Set<number>
  onSubmissionComplete?: () => void
}

type Step = "select-tile" | "upload"

export function QuickSubmissionModal({
  isOpen,
  onClose,
  bingo,
  currentTeamId,
  currentTeam,
  unlockedTiers,
  onSubmissionComplete,
}: QuickSubmissionModalProps) {
  const [step, setStep] = useState<Step>("select-tile")
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [pastedImage, setPastedImage] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep("select-tile")
      setSelectedTile(null)
      setSelectedImage(null)
      setPastedImage(null)
      setIsUploading(false)
    }
  }, [isOpen])

  // Handle tile selection
  const handleTileSelect = (tile: Tile) => {
    setSelectedTile(tile)
    setStep("upload")
  }

  // Go back to tile selection
  const handleBackToSelection = () => {
    setStep("select-tile")
    setSelectedImage(null)
    setPastedImage(null)
  }

  // Handle image change
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      setPastedImage(null)
    }
  }

  // Handle image submit
  const handleImageSubmit = async () => {
    if (!selectedTile || (!selectedImage && !pastedImage)) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("tileId", selectedTile.id)
      formData.append("teamId", currentTeamId)
      formData.append("image", selectedImage ?? pastedImage!)

      const { submitImage } = await import("@/app/actions/bingo")
      await submitImage(formData)

      // Success! Show toast
      toast({
        title: "Submission successful",
        description: `Your image has been submitted for "${selectedTile.title}"`,
        duration: 3000,
      })

      // Close modal and trigger refresh
      onClose()
      onSubmissionComplete?.()
    } catch (error) {
      console.error("Failed to submit image:", error)
      toast({
        title: "Submission failed",
        description: "There was an error submitting your image. Please try again.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsUploading(false)
    }
  }

  // Handle paste event for images
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!isOpen || step !== "upload") return

      const items = event.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.includes("image")) {
          const file = item.getAsFile()
          if (file) {
            setPastedImage(file)
            setSelectedImage(null)
            event.preventDefault()
          }
        }
      }
    }

    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [isOpen, step])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "upload" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToSelection}
                className="p-1 h-auto"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            Quick Submit
          </DialogTitle>
        </DialogHeader>

        {step === "select-tile" ? (
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select a tile to submit to
            </p>
            <TileSelectionDropdown
              tiles={bingo.tiles ?? []}
              currentTeamId={currentTeamId}
              onTileSelect={handleTileSelect}
              unlockedTiers={unlockedTiers}
            />
          </div>
        ) : (
          <div className="py-4">
            <div className="mb-4 pb-4 border-b">
              <p className="text-sm text-muted-foreground">Upload to:</p>
              <p className="font-semibold">{selectedTile?.title}</p>
              {selectedTile?.description && (
                <p className="text-xs text-muted-foreground mt-1">{selectedTile.description}</p>
              )}
            </div>
            <SubmissionUploadForm
              teamName={currentTeam?.name ?? "Your Team"}
              selectedImage={selectedImage}
              pastedImage={pastedImage}
              isUploading={isUploading}
              onImageChange={handleImageChange}
              onSubmit={handleImageSubmit}
              showTeamHeader={false}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
