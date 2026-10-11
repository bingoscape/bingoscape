import { redirect } from "next/navigation"

/** Members now live on the clan page; this keeps old links working. */
export default async function ClanMembersRedirect(props: {
  params: Promise<{ clanId: string }>
}) {
  const { clanId } = await props.params
  redirect(`/clans/${clanId}?tab=members`)
}
