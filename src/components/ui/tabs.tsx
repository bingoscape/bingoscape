"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  /**
   * `scrollable`: full width, never wider than its parent. Triggers shrink
   * first; if they still do not fit the strip scrolls horizontally (hidden
   * scrollbar, edge fade) and keeps the active trigger in view.
   */
  variant?: "default" | "scrollable"
}

const SCROLLABLE_LIST =
  "w-full min-w-0 justify-start overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant = "default", style, ...props }, ref) => {
  const innerRef = React.useRef<HTMLDivElement | null>(null)
  const [fade, setFade] = React.useState({ start: false, end: false })
  const scrollable = variant === "scrollable"

  React.useImperativeHandle(
    ref,
    () => innerRef.current as HTMLDivElement,
    []
  )

  React.useEffect(() => {
    const el = innerRef.current
    if (!scrollable || !el) return
    const update = () => {
      const start = el.scrollLeft > 1
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      setFade((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end }
      )
    }
    const revealActive = () => {
      const active = el.querySelector<HTMLElement>('[data-state="active"]')
      if (!active) return
      const left = active.offsetLeft
      const right = left + active.offsetWidth
      if (left < el.scrollLeft) el.scrollLeft = Math.max(0, left - 8)
      else if (right > el.scrollLeft + el.clientWidth)
        el.scrollLeft = right - el.clientWidth + 8
    }
    const sync = () => {
      revealActive()
      update()
    }
    sync()
    el.addEventListener("scroll", update, { passive: true })
    const resize = new ResizeObserver(sync)
    resize.observe(el)
    const mutation = new MutationObserver(sync)
    mutation.observe(el, {
      attributes: true,
      attributeFilter: ["data-state"],
      subtree: true,
      childList: true,
    })
    return () => {
      el.removeEventListener("scroll", update)
      resize.disconnect()
      mutation.disconnect()
    }
  }, [scrollable])

  const mask =
    scrollable && (fade.start || fade.end)
      ? `linear-gradient(to right, ${fade.start ? "transparent, #000 16px" : "#000, #000 0"}, ${fade.end ? "#000 calc(100% - 16px), transparent" : "#000 100%, #000"})`
      : undefined

  return (
    <TabsPrimitive.List
      ref={innerRef}
      data-overflow-end={scrollable && fade.end ? "" : undefined}
      className={cn(
        "osrs-bevel-inset inline-flex h-10 items-center justify-center gap-1 rounded-sm border border-border bg-field p-1 text-muted-foreground",
        scrollable && SCROLLABLE_LIST,
        className
      )}
      style={
        mask ? { ...style, maskImage: mask, WebkitMaskImage: mask } : style
      }
      {...props}
    />
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm border border-transparent px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:osrs-btn data-[state=active]:cursor-default",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
