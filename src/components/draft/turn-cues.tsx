"use client"

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import { Bell, BellOff, Volume2, VolumeX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { createRememberedChoice } from "@/hooks/use-remembered-choice"
import { toast } from "@/hooks/use-toast"

/**
 * What tells a captain that it is their turn (team draft 2/4, #216): a toast,
 * the tab title ("Your pick!"), an optional sound with a mute toggle and, only
 * after an explicit opt-in, a browser notification while the tab is hidden.
 * The choices are remembered per browser.
 */

const soundChoice = createRememberedChoice(
  "bingoscape:draft-sound",
  ["on", "off"] as const,
  "on"
)
const notifyChoice = createRememberedChoice(
  "bingoscape:draft-notify",
  ["on", "off"] as const,
  "off"
)

const subscribeNever = () => () => undefined

function notificationPermission(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined"
    ? "unsupported"
    : Notification.permission
}

/** A short two-note beep; silent where audio is unavailable or blocked. */
function playBeep() {
  try {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Context) return
    const context = new Context()
    const gain = context.createGain()
    gain.gain.value = 0.08
    gain.connect(context.destination)
    ;[660, 880].forEach((frequency, i) => {
      const oscillator = context.createOscillator()
      oscillator.frequency.value = frequency
      oscillator.connect(gain)
      oscillator.start(context.currentTime + i * 0.15)
      oscillator.stop(context.currentTime + i * 0.15 + 0.12)
    })
    window.setTimeout(() => void context.close(), 600)
  } catch {
    // Autoplay policy or no audio device: the other cues remain.
  }
}

interface UseTurnCuesOptions {
  /** The viewer is the on-turn captain of a running draft. */
  myTurn: boolean
  teamName: string
}

/** Fires the cues when `myTurn` turns true; keeps the tab title while it is. */
export function useTurnCues({ myTurn, teamName }: UseTurnCuesOptions) {
  const [sound] = soundChoice.useValue()
  const [notify] = notifyChoice.useValue()
  const previous = useRef(myTurn)

  // The tab title says it is your pick for as long as it is.
  useEffect(() => {
    if (!myTurn) return
    const original = document.title
    document.title = `Your pick! ${original}`.trim()
    return () => {
      document.title = original
    }
  }, [myTurn])

  useEffect(() => {
    const wasMyTurn = previous.current
    previous.current = myTurn
    // Opening the page on your turn is not news; becoming on turn is.
    if (!myTurn || wasMyTurn) return
    toast({
      title: "Your pick!",
      description: `${teamName} is on the clock.`,
    })
    if (sound === "on") playBeep()
    if (
      notify === "on" &&
      notificationPermission() === "granted" &&
      document.visibilityState === "hidden"
    ) {
      try {
        new Notification("Your pick!", {
          body: `${teamName} is on the clock.`,
          tag: "draft-turn",
        })
      } catch {
        // Some browsers only allow notifications from a service worker.
      }
    }
  }, [myTurn, teamName, sound, notify])
}

/** Mute toggle and the browser-notification opt-in, for captains. */
export function TurnCueControls() {
  const [sound, setSound] = soundChoice.useValue()
  const [notify, setNotify] = notifyChoice.useValue()
  const permission = useSyncExternalStore(
    subscribeNever,
    notificationPermission,
    () => "unsupported" as const
  )

  const toggleNotifications = useCallback(async () => {
    if (notify === "on") {
      setNotify("off")
      return
    }
    if (typeof Notification === "undefined") return
    const result =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission
    if (result === "granted") setNotify("on")
    else
      toast({
        title: "Notifications are blocked",
        description: "Allow them for this site in your browser settings.",
        variant: "destructive",
      })
  }, [notify, setNotify])

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label="Turn alerts"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={sound === "off"}
        onClick={() => setSound(sound === "on" ? "off" : "on")}
      >
        {sound === "on" ? (
          <Volume2 aria-hidden="true" className="mr-1.5 h-4 w-4" />
        ) : (
          <VolumeX aria-hidden="true" className="mr-1.5 h-4 w-4" />
        )}
        {sound === "on" ? "Mute sound" : "Sound muted"}
      </Button>
      {permission !== "unsupported" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={notify === "on" && permission === "granted"}
          onClick={() => void toggleNotifications()}
        >
          {notify === "on" && permission === "granted" ? (
            <Bell aria-hidden="true" className="mr-1.5 h-4 w-4" />
          ) : (
            <BellOff aria-hidden="true" className="mr-1.5 h-4 w-4" />
          )}
          {notify === "on" && permission === "granted"
            ? "Notifications on"
            : "Notify me"}
        </Button>
      )}
    </div>
  )
}
