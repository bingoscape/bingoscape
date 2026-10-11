import Link from "next/link"
import { redirect } from "next/navigation"
import {
  AlertTriangle,
  BowArrow,
  Ban,
  CheckCircle2,
  Clock,
  Crown,
  Users,
  type LucideIcon,
} from "lucide-react"
import { format } from "date-fns"
import type { ReactNode } from "react"

import { JoinClanButton } from "@/components/join-clan-button"
import { JoinClanDialog } from "@/components/join-clan-dialog"
import { Button } from "@/components/ui/button"
import { parseClanInviteCode } from "@/lib/clan"
import { getServerAuthSession } from "@/server/auth"
import { getClanInvitePreview } from "@/server/queries/clans"

function Notice({
  icon: Icon,
  tone,
  title,
  children,
  actions,
}: {
  icon: LucideIcon
  tone: "warning" | "danger" | "success"
  title: string
  children: ReactNode
  actions: ReactNode
}) {
  return (
    <div className="osrs-panel mx-auto max-w-lg space-y-5 rounded-sm p-6 text-center sm:p-8">
      <div className="osrs-slot mx-auto w-fit rounded-sm p-4">
        <Icon
          aria-hidden="true"
          className={
            tone === "warning"
              ? "size-10 text-warning"
              : tone === "danger"
                ? "size-10 text-danger"
                : "size-10 text-success"
          }
        />
      </div>
      <div className="space-y-2">
        <h1 className="osrs-heading text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{children}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        {actions}
      </div>
    </div>
  )
}

const backToClans = (
  <Button asChild variant="outline">
    <Link href="/clans">Back to clans</Link>
  </Button>
)

export default async function JoinClanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const rawParam = Array.isArray(params.code) ? params.code[0] : params.code
  const code = rawParam ? parseClanInviteCode(rawParam) : null

  const session = await getServerAuthSession()
  if (!session?.user) {
    const callback = code
      ? `/clans/join?code=${encodeURIComponent(code)}`
      : "/clans/join"
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(callback)}`)
  }

  const preview = code
    ? await getClanInvitePreview(code, session.user.id)
    : ({ state: "invalid" } as const)

  return (
    <main id="main" className="container mx-auto px-4 py-6 sm:py-8">
      {preview.state === "ready" && code ? (
        <div className="osrs-panel mx-auto max-w-lg space-y-5 rounded-sm p-6 sm:p-8">
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to join a clan
          </p>
          <div className="flex items-center gap-3">
            <div className="osrs-slot shrink-0 rounded-sm p-3">
              <BowArrow aria-hidden="true" className="size-8 text-primary" />
            </div>
            <h1 className="osrs-heading text-2xl font-bold wrap-break-word">
              {preview.clan.name}
            </h1>
          </div>
          {preview.clan.description && (
            <p className="text-sm text-muted-foreground">
              {preview.clan.description}
            </p>
          )}
          <dl className="osrs-slot grid gap-2 rounded-sm p-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Crown aria-hidden="true" className="size-4 text-warning" />
              <dt className="sr-only">Owner</dt>
              <dd>
                {preview.clan.owner?.runescapeName ??
                  preview.clan.owner?.name ??
                  "Unknown owner"}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <Users aria-hidden="true" className="size-4 text-info" />
              <dt className="sr-only">Members</dt>
              <dd>
                {preview.clan.memberCount}{" "}
                {preview.clan.memberCount === 1 ? "member" : "members"}
              </dd>
            </div>
          </dl>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>You&apos;ll join as a member.</li>
            {preview.becomesMain && (
              <li>This will be your Main clan, since it&apos;s your first.</li>
            )}
            {preview.invite.expiresAt && (
              <li>
                Link expires {format(preview.invite.expiresAt, "MMM d, yyyy")}.
              </li>
            )}
          </ul>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button asChild variant="outline">
              <Link href="/clans">Not now</Link>
            </Button>
            <JoinClanButton inviteCode={code} />
          </div>
        </div>
      ) : preview.state === "already-member" ? (
        <Notice
          icon={CheckCircle2}
          tone="success"
          title="You're already in this clan"
          actions={
            <>
              {backToClans}
              <Button asChild>
                <Link href={`/clans/${preview.clan.id}`}>
                  Open {preview.clan.name}
                </Link>
              </Button>
            </>
          }
        >
          You&apos;re already a member of {preview.clan.name}, so there&apos;s
          nothing to accept.
        </Notice>
      ) : preview.state === "expired" ? (
        <Notice
          icon={Clock}
          tone="warning"
          title="This invite has expired"
          actions={
            <>
              {backToClans}
              <JoinClanDialog variant="default" />
            </>
          }
        >
          The invite to {preview.clan.name} is no longer valid. Ask a clan
          manager for a new link.
        </Notice>
      ) : preview.state === "revoked" ? (
        <Notice
          icon={Ban}
          tone="danger"
          title="This invite was revoked"
          actions={
            <>
              {backToClans}
              <JoinClanDialog variant="default" />
            </>
          }
        >
          A manager of {preview.clan.name} turned this link off. Ask them for a
          new one.
        </Notice>
      ) : preview.state === "limit-reached" ? (
        <Notice
          icon={Users}
          tone="warning"
          title="This invite is used up"
          actions={
            <>
              {backToClans}
              <JoinClanDialog variant="default" />
            </>
          }
        >
          The invite to {preview.clan.name} reached its usage limit. Ask a clan
          manager for a new link.
        </Notice>
      ) : (
        <Notice
          icon={AlertTriangle}
          tone="danger"
          title="Invite not found"
          actions={
            <>
              {backToClans}
              <JoinClanDialog variant="default" />
            </>
          }
        >
          {code
            ? "We couldn't find that invite. Check the link or code and try again."
            : "This page needs an invite link or code."}
        </Notice>
      )}
    </main>
  )
}
