"use client"

import * as React from "react"

import { DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * Dialog parts that turn into a full-screen sheet below `md` (the app's phone
 * convention, see `SettingsDialogLayout`): the body scrolls, the footer stays
 * pinned above the home indicator, and the footer stacks with the primary
 * action on top.
 *
 * Usage: `<Dialog><ResponsiveDialogContent>` containing a `DialogHeader`, a
 * `<form>` wrapping `ResponsiveDialogBody` + `ResponsiveDialogFooter`.
 */
const ResponsiveDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ className, ...props }, ref) => (
  <DialogContent
    ref={ref}
    className={cn(
      "flex max-h-[90dvh] flex-col gap-4 overflow-hidden",
      // Reset the centering transform and slide/zoom origin so the sheet
      // doesn't animate in from the wrong place.
      "max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-h-none max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none",
      "max-md:data-[state=closed]:slide-out-to-left-0 max-md:data-[state=closed]:slide-out-to-top-0 max-md:data-[state=closed]:zoom-out-100 max-md:data-[state=open]:slide-in-from-left-0 max-md:data-[state=open]:slide-in-from-top-0 max-md:data-[state=open]:zoom-in-100",
      className
    )}
    {...props}
  />
))
ResponsiveDialogContent.displayName = "ResponsiveDialogContent"

const ResponsiveDialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-px",
      className
    )}
    {...props}
  />
)

const ResponsiveDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      "max-md:border-t max-md:pt-4 max-md:pb-[max(0rem,env(safe-area-inset-bottom))]",
      className
    )}
    {...props}
  />
)

export {
  ResponsiveDialogContent,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
}
