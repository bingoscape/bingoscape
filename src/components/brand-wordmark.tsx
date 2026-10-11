import { cn } from "@/lib/utils"

interface BrandWordmarkProps {
  className?: string
}

/**
 * The BingoScape logotype: the name set in the pixel display face on a sunken
 * stone plaque, "Bingo" in gold and "Scape" in parchment. The plaque is
 * theme independent (always stone), so it reads on the navbar and on the
 * parchment surface of the mobile menu alike.
 *
 * The display face is a bitmap font with a native size of 16px, so the type is
 * 16px on very narrow screens and 32px from 380px up to stay crisp. Render it
 * inside a link (or `group`) to get the yellow hover colour.
 */
export function BrandWordmark({ className }: BrandWordmarkProps) {
  return (
    <span
      className={cn(
        "bg-osrs-stone-900 font-display osrs-text-shadow inline-flex h-11 items-center rounded-sm border border-black px-3 text-base leading-none shadow-[inset_2px_2px_0_0_#17120b,inset_-1px_-1px_0_0_var(--color-osrs-stone-600)] transition-colors min-[380px]:text-[32px]",
        className
      )}
    >
      <span className="text-osrs-gold group-hover:text-osrs-yellow group-focus-visible:text-osrs-yellow">
        Bingo
      </span>
      <span className="text-osrs-parchment group-hover:text-osrs-yellow group-focus-visible:text-osrs-yellow">
        Scape
      </span>
    </span>
  )
}
