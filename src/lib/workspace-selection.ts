/**
 * Resolves which Board and which Team the Event workspace shows from the URL
 * params and the viewer's role. Shared by the server page (to fetch only what
 * is needed, e.g. tier data) and the client workspace (to render the same
 * thing), so the two can never disagree.
 */

interface SelectableBingo {
  id: string
  visible: boolean
}

interface SelectableTeam {
  id: string
}

export interface WorkspaceSelectionInput<
  B extends SelectableBingo,
  T extends SelectableTeam,
> {
  bingos: B[] | undefined
  teams: T[] | undefined
  /** admin or management (never true in the public view). */
  isManagement: boolean
  /** Public view: anyone may pick a Team via ?teamId, nobody has an own Team. */
  readOnly?: boolean
  /** The viewer's own Team. */
  ownTeamId: string | undefined
  /** `?board=` */
  board: string | null | undefined
  /** `?teamId=` */
  teamId: string | null | undefined
}

export interface WorkspaceSelection<B extends SelectableBingo> {
  /** Boards the viewer may see (players only see visible Boards). */
  bingos: B[]
  /** Active Board: ?board=, else the first visible Board. */
  bingo: B | undefined
  /** Team whose progress is shown / submitted for. */
  effectiveTeamId: string | undefined
}

export function resolveWorkspaceSelection<
  B extends SelectableBingo,
  T extends SelectableTeam,
>(input: WorkspaceSelectionInput<B, T>): WorkspaceSelection<B> {
  const bingos = (input.bingos ?? []).filter(
    (b) => input.isManagement || b.visible === true
  )
  const bingo = bingos.find((b) => b.id === input.board) ?? bingos[0]

  // ?teamId only counts when it is a real Team of this Event.
  const requestedTeamId = (input.teams ?? []).find(
    (t) => t.id === input.teamId
  )?.id

  const effectiveTeamId = input.readOnly
    ? requestedTeamId
    : input.isManagement
      ? (requestedTeamId ?? input.ownTeamId)
      : input.ownTeamId

  return { bingos, bingo, effectiveTeamId }
}
