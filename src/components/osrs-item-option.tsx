"use client"

import Image from "next/image"
import type { OsrsItem } from "@/types/osrs-items"
import { cn } from "@/lib/utils"

/**
 * How an item is named in the UI. Variants are stored as "Dragon dagger#(p)";
 * players read "Dragon dagger (p)".
 */
export function getItemDisplayName(item: Pick<OsrsItem, "name">): string {
  return item.name.replace("#", " ")
}

interface ItemIconProps {
  item: OsrsItem
  className?: string
}

/** The item's wiki icon in an inventory-slot frame; decorative, the name sits next to it. */
export function ItemIcon({ item, className }: ItemIconProps) {
  return (
    <span
      className={cn(
        "osrs-slot relative block h-9 w-9 shrink-0 overflow-hidden rounded-sm",
        className
      )}
    >
      <Image
        fill
        src={item.imageUrl}
        alt=""
        sizes="36px"
        className="object-contain p-0.5"
      />
    </span>
  )
}

interface ItemOptionProps {
  item: OsrsItem
}

/** Icon and name of an item, for lists and pickers. */
export function ItemOption({ item }: ItemOptionProps) {
  const name = getItemDisplayName(item)
  return (
    <>
      <ItemIcon item={item} />
      <span className="min-w-0 flex-1 truncate text-left font-medium" title={name}>
        {name}
      </span>
    </>
  )
}
