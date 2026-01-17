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
      className={cn(
        "flex items-center rounded-md border-2 border-yellow-400 bg-yellow-50 p-4 dark:border-yellow-500 dark:bg-yellow-500/10",
        className
      )}
    >
      <div className="shrink-0 text-yellow-400">
        {icon || <TriangleAlert className="size-5" />}
      </div>
      <div className="text-md ml-2 text-yellow-700 dark:text-yellow-300">
        {message}
      </div>
    </div>
  )
}
