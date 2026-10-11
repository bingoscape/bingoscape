import { redirect } from "next/navigation"

/** Events now live on the clan page; this keeps old links working. */
export default async function ClanEventsRedirect(props: {
  params: Promise<{ clanId: string }>
}) {
  const { clanId } = await props.params
  redirect(`/clans/${clanId}?tab=events`)
}
