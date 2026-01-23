/**
 * Comprehensive timezone utilities for player metadata and team balancing
 * Uses IANA timezone database with DST-aware offset calculations
 */

export interface TimezoneOption {
  value: string // IANA identifier (e.g., "America/New_York")
  label: string // Human-readable display name
  offset: string // Current UTC offset for display (e.g., "UTC-5")
  region: string // Geographic region for grouping
}

export interface TimezoneRegion {
  name: string
  timezones: TimezoneOption[]
}

/**
 * Comprehensive list of IANA timezones grouped by region
 * This list includes all major timezones with proper IANA identifiers
 */
const TIMEZONE_DATA: Record<string, string[]> = {
  "North America": [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Phoenix",
    "America/Los_Angeles",
    "America/Anchorage",
    "America/Honolulu",
    "America/Toronto",
    "America/Vancouver",
    "America/Edmonton",
    "America/Winnipeg",
    "America/Halifax",
    "America/St_Johns",
    "America/Mexico_City",
    "America/Monterrey",
    "America/Cancun",
  ],
  "Central & South America": [
    "America/Guatemala",
    "America/El_Salvador",
    "America/Costa_Rica",
    "America/Panama",
    "America/Bogota",
    "America/Lima",
    "America/Guayaquil",
    "America/Caracas",
    "America/La_Paz",
    "America/Santiago",
    "America/Buenos_Aires",
    "America/Montevideo",
    "America/Sao_Paulo",
    "America/Rio_de_Janeiro",
    "America/Brasilia",
    "America/Manaus",
    "America/Fortaleza",
  ],
  Caribbean: [
    "America/Havana",
    "America/Jamaica",
    "America/Puerto_Rico",
    "America/Santo_Domingo",
    "America/Port_of_Spain",
    "America/Barbados",
  ],
  "Europe - Western": [
    "Europe/London",
    "Europe/Dublin",
    "Europe/Lisbon",
    "Atlantic/Reykjavik",
    "Atlantic/Azores",
    "Atlantic/Canary",
  ],
  "Europe - Central": [
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Rome",
    "Europe/Madrid",
    "Europe/Amsterdam",
    "Europe/Brussels",
    "Europe/Vienna",
    "Europe/Prague",
    "Europe/Budapest",
    "Europe/Warsaw",
    "Europe/Stockholm",
    "Europe/Oslo",
    "Europe/Copenhagen",
    "Europe/Zurich",
  ],
  "Europe - Eastern": [
    "Europe/Athens",
    "Europe/Bucharest",
    "Europe/Sofia",
    "Europe/Helsinki",
    "Europe/Riga",
    "Europe/Tallinn",
    "Europe/Vilnius",
    "Europe/Kiev",
    "Europe/Istanbul",
    "Europe/Moscow",
    "Europe/Minsk",
  ],
  Africa: [
    "Africa/Cairo",
    "Africa/Johannesburg",
    "Africa/Lagos",
    "Africa/Nairobi",
    "Africa/Accra",
    "Africa/Algiers",
    "Africa/Casablanca",
    "Africa/Tunis",
    "Africa/Khartoum",
    "Africa/Addis_Ababa",
    "Africa/Dar_es_Salaam",
    "Africa/Kampala",
  ],
  "Middle East": [
    "Asia/Dubai",
    "Asia/Riyadh",
    "Asia/Kuwait",
    "Asia/Qatar",
    "Asia/Bahrain",
    "Asia/Muscat",
    "Asia/Baghdad",
    "Asia/Tehran",
    "Asia/Jerusalem",
    "Asia/Beirut",
    "Asia/Damascus",
    "Asia/Amman",
  ],
  "Asia - South": [
    "Asia/Karachi",
    "Asia/Kolkata",
    "Asia/Mumbai",
    "Asia/Delhi",
    "Asia/Dhaka",
    "Asia/Colombo",
    "Asia/Kathmandu",
  ],
  "Asia - Southeast": [
    "Asia/Bangkok",
    "Asia/Jakarta",
    "Asia/Singapore",
    "Asia/Kuala_Lumpur",
    "Asia/Manila",
    "Asia/Ho_Chi_Minh",
    "Asia/Phnom_Penh",
    "Asia/Yangon",
  ],
  "Asia - East": [
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Taipei",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Asia/Pyongyang",
    "Asia/Ulaanbaatar",
  ],
  "Asia - Central": [
    "Asia/Tashkent",
    "Asia/Almaty",
    "Asia/Bishkek",
    "Asia/Yekaterinburg",
    "Asia/Novosibirsk",
  ],
  "Australia & New Zealand": [
    "Australia/Sydney",
    "Australia/Melbourne",
    "Australia/Brisbane",
    "Australia/Perth",
    "Australia/Adelaide",
    "Australia/Hobart",
    "Australia/Darwin",
    "Pacific/Auckland",
    "Pacific/Fiji",
  ],
  "Pacific Islands": [
    "Pacific/Honolulu",
    "Pacific/Tahiti",
    "Pacific/Guam",
    "Pacific/Port_Moresby",
    "Pacific/Noumea",
    "Pacific/Tongatapu",
    "Pacific/Apia",
  ],
}

/**
 * Commonly used timezones for quick access
 * These appear at the top of timezone selectors
 */
export const POPULAR_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
]

/**
 * Calculate the current UTC offset for a given timezone
 * This is DST-aware and will return the correct offset based on the reference date
 *
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @param referenceDate - Date to calculate offset for (defaults to current date)
 * @returns UTC offset in hours (e.g., -5 for EST, -4 for EDT)
 */
export function getTimezoneOffset(
  timezone: string,
  referenceDate: Date = new Date()
): number {
  try {
    // Use Intl API to get DST-aware offset
    // This approach creates a date string in the target timezone and compares with UTC
    const tzDate = new Date(
      referenceDate.toLocaleString("en-US", { timeZone: timezone })
    )
    const utcDate = new Date(
      referenceDate.toLocaleString("en-US", { timeZone: "UTC" })
    )

    // Calculate difference in hours
    const offsetMs = utcDate.getTime() - tzDate.getTime()
    const offsetHours = offsetMs / (1000 * 60 * 60)

    return offsetHours
  } catch {
    // Fallback for unknown/invalid timezones
    console.warn(`Unknown timezone: ${timezone}, defaulting to UTC`)
    return 0
  }
}

/**
 * Get formatted UTC offset string for display (e.g., "UTC-5", "UTC+5:30")
 *
 * @param timezone - IANA timezone identifier
 * @param referenceDate - Date to calculate offset for
 * @returns Formatted offset string
 */
export function getFormattedOffset(
  timezone: string,
  referenceDate: Date = new Date()
): string {
  const offset = getTimezoneOffset(timezone, referenceDate)

  // Handle zero offset
  if (offset === 0) return "UTC"

  // Calculate hours and minutes
  const absOffset = Math.abs(offset)
  const hours = Math.floor(absOffset)
  const minutes = Math.round((absOffset - hours) * 60)

  // Format sign
  const sign = offset > 0 ? "-" : "+"

  // Format with minutes if not whole hour
  if (minutes > 0) {
    return `UTC${sign}${hours}:${minutes.toString().padStart(2, "0")}`
  }

  return `UTC${sign}${hours}`
}

/**
 * Get human-readable label for timezone
 * Converts IANA identifier to display name (e.g., "America/New_York" → "New York")
 *
 * @param timezone - IANA timezone identifier
 * @returns Human-readable timezone name
 */
export function getTimezoneLabel(timezone: string): string {
  // Extract city name from IANA identifier
  const parts = timezone.split("/")
  const city = parts[parts.length - 1] ?? timezone

  // Replace underscores with spaces
  return city.replace(/_/g, " ")
}

/**
 * Create a timezone option object with all necessary display information
 *
 * @param timezone - IANA timezone identifier
 * @param region - Geographic region for grouping
 * @param referenceDate - Date to calculate offset for
 * @returns Timezone option object
 */
export function createTimezoneOption(
  timezone: string,
  region: string,
  referenceDate: Date = new Date()
): TimezoneOption {
  return {
    value: timezone,
    label: getTimezoneLabel(timezone),
    offset: getFormattedOffset(timezone, referenceDate),
    region,
  }
}

/**
 * Get all timezones as flat array of options
 *
 * @param referenceDate - Date to calculate offsets for
 * @returns Array of all timezone options
 */
export function getAllTimezones(
  referenceDate: Date = new Date()
): TimezoneOption[] {
  const allTimezones: TimezoneOption[] = []

  for (const [region, timezones] of Object.entries(TIMEZONE_DATA)) {
    for (const timezone of timezones) {
      allTimezones.push(createTimezoneOption(timezone, region, referenceDate))
    }
  }

  return allTimezones
}

/**
 * Get timezones grouped by region
 *
 * @param referenceDate - Date to calculate offsets for
 * @returns Array of regions with their timezones
 */
export function getTimezonesByRegion(
  referenceDate: Date = new Date()
): TimezoneRegion[] {
  return Object.entries(TIMEZONE_DATA).map(([region, timezones]) => ({
    name: region,
    timezones: timezones.map((tz) =>
      createTimezoneOption(tz, region, referenceDate)
    ),
  }))
}

/**
 * Get popular/commonly used timezones as options
 *
 * @param referenceDate - Date to calculate offsets for
 * @returns Array of popular timezone options
 */
export function getPopularTimezones(
  referenceDate: Date = new Date()
): TimezoneOption[] {
  return POPULAR_TIMEZONES.map((timezone) => {
    // Find region for this timezone
    const region =
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      Object.entries(TIMEZONE_DATA).find(([_region, timezones]) =>
        timezones.includes(timezone)
      )?.[0] ?? "Other"

    return createTimezoneOption(timezone, region, referenceDate)
  })
}

/**
 * Search timezones by label or IANA identifier
 *
 * @param query - Search query
 * @param referenceDate - Date to calculate offsets for
 * @returns Array of matching timezone options
 */
export function searchTimezones(
  query: string,
  referenceDate: Date = new Date()
): TimezoneOption[] {
  if (!query) return getAllTimezones(referenceDate)

  const lowerQuery = query.toLowerCase()
  const allTimezones = getAllTimezones(referenceDate)

  return allTimezones.filter(
    (tz) =>
      tz.label.toLowerCase().includes(lowerQuery) ||
      tz.value.toLowerCase().includes(lowerQuery) ||
      tz.offset.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Validate if a timezone string is a valid IANA identifier
 *
 * @param timezone - Timezone string to validate
 * @returns true if valid, false otherwise
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    // Attempt to format a date with this timezone
    new Date().toLocaleString("en-US", { timeZone: timezone })
    return true
  } catch {
    return false
  }
}
