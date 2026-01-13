"use client"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Upload } from "lucide-react"

interface QuickSubmissionButtonProps {
  currentTeamId: string | undefined
  isSubmissionsLocked: boolean
  onClick: () => void
  className?: string
}

export function QuickSubmissionButton({
  currentTeamId,
  isSubmissionsLocked,
  onClick,
  className,
}: QuickSubmissionButtonProps) {
  // Don't show button if submissions are locked
  if (isSubmissionsLocked) {
    return null
  }

  // If user doesn't have a team, show disabled button with tooltip
  if (!currentTeamId) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="default"
                className={`${className ?? ""}`}
                disabled
              >
                <Upload className="h-4 w-4 mr-2" />
                Quick Submit
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Join a team to submit</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // User has a team and submissions are not locked
  return (
    <Button
      variant="default"
      className={`bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white ${className ?? ""}`}
      onClick={onClick}
    >
      <Upload className="h-4 w-4 mr-2" />
      Quick Submit
    </Button>
  )
}
