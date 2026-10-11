"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ResponsiveDialogContent } from "@/components/responsive-dialog"
import { Button } from "@/components/ui/button"
import getRandomFrog from "@/lib/getRandomFrog"

interface FullSizeImageDialogProps {
  isOpen: boolean
  onClose: () => void
  imageSrc: string
  imageAlt: string
}

export function FullSizeImageDialog({
  isOpen,
  onClose,
  imageSrc,
  imageAlt,
}: FullSizeImageDialogProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null)

  const pointerDistance = () => {
    const [a, b] = Array.from(pointers.current.values())
    return a && b ? Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1) : 1
  }

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  // Reset zoom and position when dialog opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset on dialog open
      resetZoom()
    }
  }, [isOpen])

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

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      pinchStart.current = { distance: pointerDistance(), scale }
      setIsDragging(false)
    } else if (scale > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2 && pinchStart.current) {
      const ratio = pointerDistance() / pinchStart.current.distance
      setScale(Math.min(Math.max(pinchStart.current.scale * ratio, 0.5), 5))
    } else if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handlePointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    pinchStart.current = null
    setIsDragging(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-h-[90dvh] sm:max-w-[90vw]">
        <DialogHeader className="p-4 pr-14 pointer-coarse:pr-16">
          <DialogTitle>Submission</DialogTitle>
        </DialogHeader>

        <div
          ref={containerRef}
          className="relative min-h-[40dvh] w-full flex-1 cursor-move touch-none overflow-hidden"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
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
              src={imageSrc || getRandomFrog()}
              alt={imageAlt}
              fill
              style={{ objectFit: "contain" }}
              draggable={false}
              priority
            />
          </div>
        </div>

        <div className="flex shrink-0 justify-center gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            variant="secondary"
            size="icon"
            onClick={zoomIn}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={zoomOut}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={resetZoom}
            aria-label="Reset zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </ResponsiveDialogContent>
    </Dialog>
  )
}
