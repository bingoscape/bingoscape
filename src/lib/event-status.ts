/**
 * Whether the Event has started. Once true it stays true forever, including
 * after the Event ended. Battleship ship placement is locked from this moment.
 *
 * `now` is injectable so callers and tests control the clock.
 */
export function hasEventStarted(
  startDate: Date | string | number,
  now: Date = new Date()
): boolean {
  return now.getTime() >= new Date(startDate).getTime()
}
