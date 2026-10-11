import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initialsOf } from "@/lib/super-admin-format"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
  label: string
  image: string | null
  className?: string
}

/**
 * Decorative: the person's name is always rendered next to it, so the image has
 * an empty alt. The fallback is deterministic initials, never a random picture
 * (a random fallback differs between server and client render).
 */
export function UserAvatar({ label, image, className }: UserAvatarProps) {
  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback aria-hidden="true" className="text-xs font-medium">
        {initialsOf(label)}
      </AvatarFallback>
    </Avatar>
  )
}
