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

const AnimatedProgress = React.forwardRef<HTMLDivElement, AnimatedProgressProps>(
  ({ className, value = 0, indicatorClassName, animate = true, duration = 1000, ...props }, ref) => {
    const [animatedValue, setAnimatedValue] = React.useState(0)

    React.useEffect(() => {
      if (animate) {
        const startTime = Date.now()
        const startValue = animatedValue
        const endValue = Math.min(100, Math.max(0, value))

        const animateProgress = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(1, elapsed / duration)
          
          // Use easing function for smooth animation
          const eased = 1 - Math.pow(1 - progress, 3)
          const currentValue = startValue + (endValue - startValue) * eased

          setAnimatedValue(currentValue)

          if (progress < 1) {
            requestAnimationFrame(animateProgress)
          }
        }

        requestAnimationFrame(animateProgress)
      } else {
        setAnimatedValue(value)
      }
    }, [value, animate, duration, animatedValue])

    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full flex-1 bg-primary transition-all duration-300 ease-out",
            indicatorClassName
          )}
          style={{ transform: `translateX(-${100 - animatedValue}%)` }}
        />
      </div>
    )
  }
)

AnimatedProgress.displayName = "AnimatedProgress"

export { AnimatedProgress }