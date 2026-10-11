import { redirect } from "next/navigation"
import { BowArrow } from "lucide-react"

import { ClanCard } from "@/components/clan-card"
import CreateClanModal from "@/components/create-clan-modal"
import { JoinClanDialog } from "@/components/join-clan-dialog"
import { PageHeader } from "@/components/page-header"
import { getServerAuthSession } from "@/server/auth"
import { getUserClanSummaries } from "@/server/queries/clans"

function EmptyClans() {
  return (
    <div className="osrs-panel mx-auto max-w-3xl rounded-sm p-6 sm:p-10">
      <div className="mb-6 text-center">
        <div className="osrs-slot mx-auto mb-4 w-fit rounded-sm p-4">
          <BowArrow aria-hidden="true" className="size-10 text-primary" />
        </div>
        <h2 className="osrs-heading text-2xl font-bold">No Clans Yet</h2>
        <p className="mt-2 text-muted-foreground">
          Start your own clan, or join one with an invite to run bingo events
          together.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section
          aria-labelledby="empty-clan-create"
          className="osrs-slot flex flex-col gap-3 rounded-sm p-4"
        >
          <h3 id="empty-clan-create" className="font-semibold">
            Create a Clan
          </h3>
          <p className="text-sm text-muted-foreground">
            You become its owner, then invite your crew with a link.
          </p>
          <CreateClanModal className="mt-auto w-full" />
        </section>
        <section
          aria-labelledby="empty-clan-join"
          className="osrs-slot flex flex-col gap-3 rounded-sm p-4"
        >
          <h3 id="empty-clan-join" className="font-semibold">
            Got an invite?
          </h3>
          <p className="text-sm text-muted-foreground">
            Paste the invite link or code a clan manager sent you.
          </p>
          <JoinClanDialog className="mt-auto w-full" />
        </section>
      </div>
    </div>
  )
}

export default async function ClansPage() {
  const session = await getServerAuthSession()
  if (!session?.user) {
    redirect("/sign-in?callbackUrl=%2Fclans")
  }

  const clans = await getUserClanSummaries(session.user.id)
  const hasClans = clans.length > 0

  return (
    <main id="main" className="container mx-auto px-4 py-6 sm:py-8">
      <div className="space-y-5">
        <PageHeader
          title="Clans"
          icon={BowArrow}
          meta={
            hasClans ? (
              <span>
                {clans.length} {clans.length === 1 ? "clan" : "clans"}
              </span>
            ) : undefined
          }
          actions={
            hasClans ? (
              <>
                <CreateClanModal size="sm" className="w-full sm:w-auto" />
                <JoinClanDialog size="sm" className="w-full sm:w-auto" />
              </>
            ) : undefined
          }
        />

        {hasClans ? (
          <ul
            role="list"
            aria-label="Your clans"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3"
          >
            {clans.map((clan) => (
              <li key={clan.id}>
                <ClanCard clan={clan} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyClans />
        )}
      </div>
    </main>
  )
}
