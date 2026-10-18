import { getTimezoneOffset } from "@/lib/timezones"

/**
 * The UTC offset of an IANA timezone in whole hours east of UTC (New York is
 * -5, Tokyo +9), or null for no / an unknown zone. `getTimezoneOffset` counts
 * hours *behind* UTC, hence the sign. The draft sends this offset to its
 * members instead of the zone name, which is all the balance panel needs.
 */
export function utcOffsetOfTimezone(
  timezone: string | null | undefined,
  referenceDate: Date = new Date()
): number | null {
  if (!timezone) return null
  const east = Math.round(-getTimezoneOffset(timezone, referenceDate))
  return east === 0 ? 0 : east
}
