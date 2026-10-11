import { formatInTimeZone } from "date-fns-tz"

export type EventState = "active" | "upcoming" | "past"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "45m", "5h", "1d 4h", "6d": coarse on purpose so a server-rendered value stays right. */
export function formatDuration(ms: number): string {
  const abs = Math.max(0, ms)
  if (abs < HOUR) return `${Math.max(1, Math.floor(abs / MINUTE))}m`
  if (abs < DAY) return `${Math.floor(abs / HOUR)}h`
  if (abs < 2 * DAY) {
    const hours = Math.floor((abs - DAY) / HOUR)
    return hours > 0 ? `1d ${hours}h` : "1d"
  }
  return `${Math.floor(abs / DAY)}d`
}

/** Text for the status chip: "Live · ends in 2d", "Starts in 3d", "Ended Oct 3". */
export function getStatusLabel(
  state: EventState,
  start: Date,
  end: Date,
  timeZone: string,
  now: Date
): string {
  switch (state) {
    case "active":
      return `Live · ends in ${formatDuration(end.getTime() - now.getTime())}`
    case "upcoming":
      return `Starts in ${formatDuration(start.getTime() - now.getTime())}`
    case "past":
      return `Ended ${formatInTimeZone(end, timeZone, "MMM d")}`
  }
}

/** "Oct 11 – Oct 18"; the year is only added when it isn't the current one. */
export function formatDateRange(
  start: Date,
  end: Date,
  timeZone: string,
  now: Date
): string {
  const currentYear = formatInTimeZone(now, timeZone, "yyyy")
  const fmt = (d: Date) =>
    formatInTimeZone(
      d,
      timeZone,
      formatInTimeZone(d, timeZone, "yyyy") === currentYear
        ? "MMM d"
        : "MMM d, yyyy"
    )
  return `${fmt(start)} – ${fmt(end)}`
}
