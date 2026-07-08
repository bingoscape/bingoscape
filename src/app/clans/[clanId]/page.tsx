import { getClanDetails, getClanMembers } from "@/app/actions/clan"
import { ClanDetailClient } from "./clan-detail-client"
import { notFound, redirect } from "next/navigation"
import { getServerAuthSession } from "@/server/auth"

export default async function ClanDetailPage(props: {
  params: Promise<{ clanId: string }>
}) {
  const { clanId } = await props.params
  const session = await getServerAuthSession()

  if (!session) {
    redirect("/login")
  }

  let clanDetails;
  let members;

  try {
    const data = await Promise.all([
      getClanDetails(clanId),
      getClanMembers(clanId)
    ])
    clanDetails = data[0];
    members = data[1];

    if (!clanDetails) {
      notFound()
    }
  } catch (error) {
    if (error instanceof Error && error.message === "You are not a member of this clan") {
      notFound()
    }
    throw error
  }

  return (
    <ClanDetailClient 
      initialClanDetails={clanDetails} 
      initialMembers={members} 
      clanId={clanId} 
    />
  )
}
