import { Link2, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CodephraseDisplay } from "@/components/codephrase-display"
import { EventTimeDisplay } from "@/components/event-time-display"
import { GenerateEventInviteLink } from "@/components/generate-event-invite-link"
import { ShareEventButton } from "@/components/share-event-button"
import type { EventRule } from "@/app/actions/events"
import type { UUID } from "crypto"

interface InfoPanelProps {
  eventId: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  timezone: string
  /** Event locked for new registrations. */
  locked?: boolean
  registrationOpen?: boolean
  hasRegistrationDeadline?: boolean
  isPublic: boolean
  rules: EventRule[]
  /** Active Board (description, size, codephrase). */
  board?: {
    title: string
    description: string | null
    rows: number
    columns: number
    codephrase: string
  } | null
  /** May generate invite links (`event:invite`). */
  canInvite: boolean
  /** Public view: no codephrase, no invite link, no share button. */
  readOnly?: boolean
}

/** Event description, dates, rules, the active Board's info and sharing. */
export function InfoPanel({
  eventId,
  title,
  description,
  startDate,
  endDate,
  timezone,
  locked,
  registrationOpen,
  hasRegistrationDeadline,
  isPublic,
  rules,
  board,
  canInvite,
  readOnly = false,
}: InfoPanelProps) {
  return (
    <div className="space-y-5 text-sm">
      {description && (
        <section aria-label="About this event">
          <h3 className="mb-1 font-semibold text-foreground">About</h3>
          <p className="leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {description}
          </p>
        </section>
      )}

      <section aria-label="Dates">
        <h3 className="mb-1 font-semibold text-foreground">When</h3>
        <EventTimeDisplay date={startDate} label="Start" eventTz={timezone} />
        <EventTimeDisplay date={endDate} label="End" eventTz={timezone} />
        {hasRegistrationDeadline && registrationOpen !== undefined && (
          <Badge
            variant={registrationOpen ? "success" : "destructive"}
            className="mt-1"
          >
            Registration {registrationOpen ? "open" : "closed"}
          </Badge>
        )}
        {locked && (
          <p className="mt-2 flex items-center gap-2 text-muted-foreground">
            <Lock aria-hidden="true" className="h-4 w-4" />
            Registrations are locked for this event.
          </p>
        )}
      </section>

      {board && (
        <section aria-label="Board info">
          <h3 className="mb-1 font-semibold text-foreground">{board.title}</h3>
          {board.description && (
            <p className="mb-1 leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {board.description}
            </p>
          )}
          <p className="text-muted-foreground">
            {board.rows} rows x {board.columns} columns
          </p>
          {!readOnly && board.codephrase && (
            <div className="mt-2">
              <CodephraseDisplay codephrase={board.codephrase} />
            </div>
          )}
        </section>
      )}

      {rules.length > 0 && (
        <section aria-label="Rules">
          <h3 className="mb-1 font-semibold text-foreground">Rules</h3>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            {rules.map((rule) => (
              <li key={rule.id}>{rule.content}</li>
            ))}
          </ol>
        </section>
      )}

      {!readOnly && (canInvite || isPublic) && (
        <section aria-label="Share" className="flex flex-wrap gap-2">
          {canInvite && (
            <GenerateEventInviteLink eventId={eventId as UUID}>
              <Button variant="outline" size="sm" className="gap-2">
                <Link2 aria-hidden="true" className="h-4 w-4" />
                Invite link
              </Button>
            </GenerateEventInviteLink>
          )}
          {isPublic && (
            <ShareEventButton
              eventId={eventId}
              eventTitle={title}
              isPublic={isPublic}
            />
          )}
        </section>
      )}
    </div>
  )
}
