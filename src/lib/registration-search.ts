interface SearchableRegistration {
  message?: string | null
  user: {
    name?: string | null
    email?: string | null
    runescapeName?: string | null
  }
}

/**
 * True when the search term appears in any of the fields a manager can see on a
 * registration request. An empty term matches everything.
 */
export function matchesRegistrationSearch(
  request: SearchableRegistration,
  search: string
): boolean {
  const term = search.trim().toLowerCase()
  if (term === "") return true

  return [
    request.user.name,
    request.user.email,
    request.user.runescapeName,
    request.message,
  ].some((value) => value?.toLowerCase().includes(term) ?? false)
}
