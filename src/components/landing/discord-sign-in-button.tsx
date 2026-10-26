"use client"

import { DiscordLogoIcon } from "@radix-ui/react-icons"

import { signIn } from "@/lib/auth-client"

export function DiscordSignInButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() =>
        void signIn.social({ provider: "discord", callbackURL: "/" })
      }
      className={className}
    >
      <DiscordLogoIcon aria-hidden="true" className="h-5 w-5" />
      Get Started with Discord
    </button>
  )
}
