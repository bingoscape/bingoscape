"use client"

import { signIn } from "next-auth/react"
import { DiscordLogoIcon } from "@radix-ui/react-icons"

export function DiscordSignInButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => void signIn("discord", { callbackUrl: "/" })}
      className={className}
    >
      <DiscordLogoIcon aria-hidden="true" className="h-5 w-5" />
      Get Started with Discord
    </button>
  )
}
