"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface FullSizeImageDialogProps {
  isOpen: boolean
  onClose: () => void
  imageSrc: string
  imageAlt: string
}

export function FullSizeImageDialog({ isOpen, onClose, imageSrc, imageAlt }: FullSizeImageDialogProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset zoom and position when dialog opens
  useEffect(() => {
    if (isOpen) {
      resetZoom()
    }
  }, [isOpen])

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 5))
  }

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5))
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.25, 5))
    } else {
      setScale((prev) => Math.max(prev - 0.25, 0.5))
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] p-0">
        <DialogHeader className="p-4">
          <DialogTitle>Submission</DialogTitle>
        </DialogHeader>

        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button variant="secondary" size="icon" onClick={zoomIn} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={zoomOut} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={resetZoom} aria-label="Reset zoom">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div
          ref={containerRef}
          className="relative w-full h-full min-h-[60vh] overflow-hidden cursor-move"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? "none" : "transform 0.2s ease-out",
              transformOrigin: "center",
              width: "100%",
              height: "100%",
              position: "relative",
            }}
          >
            <Image
              src={imageSrc || "/placeholder.svg"}
              alt={imageAlt}
              fill
              style={{ objectFit: "contain" }}
              draggable={false}
              priority
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

