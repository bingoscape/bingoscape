import { cn } from "@/lib/utils"

interface ShipVisualProps {
  length: number
  className?: string
  segmentClassName?: string
}

export function ShipVisual({
  length,
  className,
  segmentClassName,
}: ShipVisualProps) {
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      aria-hidden
      title={`${length}-tile ship`}
    >
      {Array.from({ length }, (_, index) => (
        <span
          key={index}
          className={cn(
            "rounded-sm border border-primary/30 bg-primary/50",
            segmentClassName ?? "h-5 w-8"
          )}
        />
      ))}
    </div>
  )
}
