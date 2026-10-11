interface EventProgressBarProps {
  label: string
  completed: number
  total: number
}

/** OSRS orb-bar style meter; the visible "7 / 16" doubles as the text alternative. */
export function EventProgressBar({
  label,
  completed,
  total,
}: EventProgressBarProps) {
  if (total <= 0) return null

  const value = Math.min(total, Math.max(0, completed))
  const percent = (value / total) * 100

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      className="relative h-5 border border-black bg-osrs-stone-950 shadow-[inset_2px_2px_0_0_#17120b,inset_-1px_-1px_0_0_#4b4132]"
    >
      <div
        className="h-full bg-osrs-green shadow-[inset_0_-2px_0_0_rgb(0_0_0/0.35)]"
        style={{ width: `${percent}%` }}
      />
      {total <= 25 && (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent calc(${100 / total}% - 1px), #1c170f calc(${100 / total}% - 1px), #1c170f ${100 / total}%)`,
          }}
        />
      )}
      <span className="osrs-qty absolute inset-0 grid place-items-center text-sm">
        {value} / {total}
      </span>
    </div>
  )
}
