/** Color palette for ship lengths (shadcn Badge custom-colors style). */
export type ShipLengthColor = {
  badge: string
  badgeSelected: string
  tile: string
  tileCurrent: string
}

const PALETTE: ShipLengthColor[] = [
  {
    badge:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    badgeSelected: "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-background",
    tile: "border-blue-600 bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400",
    tileCurrent:
      "border-blue-500 bg-blue-200/90 dark:bg-blue-800/60 ring-2 ring-blue-500",
  },
  {
    badge:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
    badgeSelected:
      "ring-2 ring-green-500 ring-offset-2 dark:ring-offset-background",
    tile: "border-green-600 bg-green-100 dark:bg-green-900/40 ring-2 ring-green-400",
    tileCurrent:
      "border-green-500 bg-green-200/90 dark:bg-green-800/60 ring-2 ring-green-500",
  },
  {
    badge:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
    badgeSelected: "ring-2 ring-sky-500 ring-offset-2 dark:ring-offset-background",
    tile: "border-sky-600 bg-sky-100 dark:bg-sky-900/40 ring-2 ring-sky-400",
    tileCurrent:
      "border-sky-500 bg-sky-200/90 dark:bg-sky-800/60 ring-2 ring-sky-500",
  },
  {
    badge:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
    badgeSelected:
      "ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-background",
    tile: "border-purple-600 bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-400",
    tileCurrent:
      "border-purple-500 bg-purple-200/90 dark:bg-purple-800/60 ring-2 ring-purple-500",
  },
  {
    badge:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    badgeSelected:
      "ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-background",
    tile: "border-amber-600 bg-amber-100 dark:bg-amber-900/40 ring-2 ring-amber-400",
    tileCurrent:
      "border-amber-500 bg-amber-200/90 dark:bg-amber-800/60 ring-2 ring-amber-500",
  },
  {
    badge:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
    badgeSelected: "ring-2 ring-rose-500 ring-offset-2 dark:ring-offset-background",
    tile: "border-rose-600 bg-rose-100 dark:bg-rose-900/40 ring-2 ring-rose-400",
    tileCurrent:
      "border-rose-500 bg-rose-200/90 dark:bg-rose-800/60 ring-2 ring-rose-500",
  },
]

export function buildLengthColorMap(
  lengths: number[]
): Map<number, ShipLengthColor> {
  const sorted = [...new Set(lengths)].sort((a, b) => a - b)
  const map = new Map<number, ShipLengthColor>()
  sorted.forEach((length, index) => {
    map.set(length, PALETTE[index % PALETTE.length]!)
  })
  return map
}

export function firstUnplacedLength(
  requiredCounts: Record<number, number>,
  placedCounts: Record<number, number>
): number | null {
  for (const length of Object.keys(requiredCounts)
    .map(Number)
    .sort((a, b) => a - b)) {
    const required = requiredCounts[length] ?? 0
    const placed = placedCounts[length] ?? 0
    if (placed < required) return length
  }
  return null
}
