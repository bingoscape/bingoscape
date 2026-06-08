export function isEventActive(
  startDate: Date | string,
  endDate: Date | string
): boolean {
  const now = new Date()
  return now >= new Date(startDate) && now <= new Date(endDate)
}

/** Who can see tile objectives/images on battleship boards before the event starts. */
export function canSeeBattleshipTileDetails(
  eventActive: boolean,
  eventCreatorId: string | null | undefined,
  userId: string | undefined,
  userRole: "admin" | "management" | "participant"
): boolean {
  if (eventActive) return true
  if (userId && eventCreatorId && userId === eventCreatorId) return true
  if (userRole === "admin" || userRole === "management") return true
  return false
}
