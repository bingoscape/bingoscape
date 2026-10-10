import { redirect } from "next/navigation"

/**
 * Public Boards are no longer a page of their own: the public workspace shows
 * every Board. Old links land on the same Board there.
 */
export default async function PublicBingoRedirectPage(props: {
  params: Promise<{ id: string; bingoId: string }>
}) {
  const { id, bingoId } = await props.params
  redirect(`/public/events/${id}?board=${encodeURIComponent(bingoId)}`)
}
