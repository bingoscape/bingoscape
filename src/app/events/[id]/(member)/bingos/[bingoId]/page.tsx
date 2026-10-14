import { redirect } from "next/navigation"

/**
 * Boards are no longer a page of their own: the Event workspace shows every
 * Board. Old links (bookmarks, notifications) land on the same Board there.
 */
export default async function BingoRedirectPage(props: {
  params: Promise<{ id: string; bingoId: string }>
}) {
  const { id, bingoId } = await props.params
  redirect(`/events/${id}?board=${encodeURIComponent(bingoId)}`)
}
