import { cn } from "@/lib/utils"
import { TriangleAlert } from "lucide-react"

export default function AlertBanner({
  message,
  icon,
  className,
}: {
  message: string
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        "osrs-bevel flex items-center rounded-sm border border-border bg-warning/15 p-4",
        className
      )}
    >
      <div className="shrink-0 text-warning">
        {icon || <TriangleAlert className="size-5" />}
      </div>
      <div className="text-md ml-2 font-medium text-foreground">{message}</div>
    </div>
  )
}
