import type { OsrsItem } from "@/types/osrs-items"

/** A small item index shared by the picker tests; names are searched by substring. */
export const ABYSSAL_WHIP: OsrsItem = {
  id: 4151,
  name: "Abyssal whip",
  baseName: "Abyssal whip",
  imageUrl: "/whip.png",
}

export const ABYSSAL_TENTACLE: OsrsItem = {
  id: 12006,
  name: "Abyssal tentacle",
  baseName: "Abyssal tentacle",
  imageUrl: "/tentacle.png",
}

/** A variant: stored as "Name#(variant)", with several item ids. */
export const DRAGON_DAGGER_P: OsrsItem = {
  id: [1231, 5680],
  name: "Dragon dagger#(p)",
  baseName: "Dragon dagger",
  variant: "(p)",
  imageUrl: "/dagger.png",
}

export const ALL_ITEMS: OsrsItem[] = [
  ABYSSAL_WHIP,
  ABYSSAL_TENTACLE,
  DRAGON_DAGGER_P,
]

/** Mimics `searchOsrsItems`: every item whose name contains the query. */
export function searchFixtureItems(query: string) {
  const needle = query.trim().toLowerCase()
  return {
    success: true as const,
    items: ALL_ITEMS.filter((item) => item.name.toLowerCase().includes(needle)),
  }
}
