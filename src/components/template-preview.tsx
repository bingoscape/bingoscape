import Image from "next/image"
import { cn } from "@/lib/utils"
import getRandomFrog from "@/lib/getRandomFrog"

interface TemplatePreviewProps {
  previewImage: string | null
  title: string
  className?: string
}

export function TemplatePreview({
  previewImage,
  title,
  className,
}: TemplatePreviewProps) {
  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden rounded-md bg-muted",
        className
      )}
    >
      {previewImage ? (
        <Image
          src={previewImage || getRandomFrog()}
          alt={`Preview of ${title}`}
          fill
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="grid h-3/4 w-3/4 grid-cols-3 grid-rows-3 gap-1 opacity-50">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-sm bg-muted-foreground/20" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
