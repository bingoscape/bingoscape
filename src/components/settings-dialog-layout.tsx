"use client"

import type { FormEvent, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export interface SettingsDialogTab {
  id: string
  label: string
  icon: LucideIcon
}

interface SettingsDialogLayoutProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  tabs: SettingsDialogTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  onSubmit: () => void | Promise<void>
  isSubmitting: boolean
  contentClassName?: string
  children: ReactNode
}

/**
 * Sidebar-style settings dialog. Full-screen sheet with a scrolling tab strip
 * below `md`, two-column modal with a sidebar from `md` up.
 */
export function SettingsDialogLayout({
  isOpen,
  onClose,
  title,
  description,
  tabs,
  activeTab,
  onTabChange,
  onSubmit,
  isSubmitting,
  contentClassName,
  children,
}: SettingsDialogLayoutProps) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void onSubmit()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "flex max-w-4xl overflow-hidden border-0 p-0 md:h-[min(600px,calc(100dvh-2rem))]",
          // Full-screen sheet on phones: reset the centering transform and the
          // slide/zoom origin so it doesn't animate in from the wrong place.
          "max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:flex-col max-md:rounded-none",
          "max-md:data-[state=closed]:slide-out-to-left-0 max-md:data-[state=closed]:slide-out-to-top-0 max-md:data-[state=closed]:zoom-out-100 max-md:data-[state=open]:slide-in-from-left-0 max-md:data-[state=open]:slide-in-from-top-0 max-md:data-[state=open]:zoom-in-100",
          contentClassName
        )}
      >
        <div className="bg-muted/40 flex shrink-0 flex-col border-b md:w-64 md:border-r md:border-b-0 md:p-4">
          <DialogHeader className="text-left max-md:px-4 max-md:pt-4 max-md:pr-16 max-md:pb-2 md:mb-6">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="text-xs">
              {description}
            </DialogDescription>
          </DialogHeader>
          <div
            role="tablist"
            aria-orientation="vertical"
            className="flex gap-1 overflow-x-auto overscroll-x-contain max-md:px-2 max-md:pb-2 md:flex-col md:overflow-visible"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm whitespace-nowrap transition-colors md:min-h-0 md:gap-3",
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-background/50 relative flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div
            role="tabpanel"
            className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-8"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="bg-background relative z-10 flex shrink-0 flex-col-reverse gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
