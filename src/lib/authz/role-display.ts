/**
 * How a role looks in the UI. Lookups by key, not comparisons, so components
 * never branch on a role string; what a role may do comes from capabilities.
 */
export type RoleBadgeVariant = "default" | "secondary" | "outline"

const ROLE_BADGE_VARIANTS: Readonly<Record<string, RoleBadgeVariant>> = {
  admin: "default",
  management: "secondary",
}

/** Badge variant of an Event or Clan role; every other role is `outline`. */
export function roleBadgeVariant(role: string): RoleBadgeVariant {
  return ROLE_BADGE_VARIANTS[role] ?? "outline"
}
