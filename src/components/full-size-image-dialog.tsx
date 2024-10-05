import React from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface FullSizeImageDialogProps {
  isOpen: boolean
  onClose: () => void
  imageSrc: string
  imageAlt: string
}

export function FullSizeImageDialog({ isOpen, onClose, imageSrc, imageAlt }: FullSizeImageDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] p-0">
        <DialogHeader>
          <DialogTitle>Submission</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-full min-h-[50vh]">
          <Image
            src={imageSrc}
            alt={imageAlt}
            layout="fill"
            objectFit="contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
