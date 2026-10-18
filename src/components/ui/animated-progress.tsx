"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface AnimatedProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  className?: string
  indicatorClassName?: string
  animate?: boolean
  duration?: number
}

const AnimatedProgress = React.forwardRef<
  HTMLDivElement,
  AnimatedProgressProps
>(
  (
    {
      className,
      value = 0,
      indicatorClassName,
      animate = true,
      duration = 1000,
      ...props
    },
    ref
  ) => {
    const [animatedValue, setAnimatedValue] = React.useState(0)
    // Where the animation currently is, so a new target continues from there
    const currentValueRef = React.useRef(0)

    React.useEffect(() => {
      if (!animate) return

      const startTime = Date.now()
      const startValue = currentValueRef.current
      const endValue = Math.min(100, Math.max(0, value))
      let frame = 0

      const animateProgress = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(1, elapsed / duration)

        // Use easing function for smooth animation
        const eased = 1 - Math.pow(1 - progress, 3)
        const currentValue = startValue + (endValue - startValue) * eased

        currentValueRef.current = currentValue
        setAnimatedValue(currentValue)

        if (progress < 1) {
          frame = requestAnimationFrame(animateProgress)
        }
      }

      frame = requestAnimationFrame(animateProgress)
      return () => cancelAnimationFrame(frame)
    }, [value, animate, duration])

    const shownValue = animate ? animatedValue : value

    return (
      <div
        ref={ref}
        className={cn(
          "osrs-panel-inset relative h-2 w-full overflow-hidden rounded-none",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full flex-1 bg-success shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] transition-all duration-300 ease-out",
            indicatorClassName
          )}
          style={{ transform: `translateX(-${100 - shownValue}%)` }}
        />
      </div>
    )
  }
)

AnimatedProgress.displayName = "AnimatedProgress"

export { AnimatedProgress }
