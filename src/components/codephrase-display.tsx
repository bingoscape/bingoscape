import React from "react"

interface CodephraseDisplayProps {
  codephrase: string
}

export function CodephraseDisplay({ codephrase }: CodephraseDisplayProps) {
  return (
    <div className="mb-6 rounded-lg bg-primary p-4 text-primary-foreground shadow-md">
      <h2 className="mb-2 text-2xl font-bold">Codephrase</h2>
      <p className="text-xl">{codephrase}</p>
    </div>
  )
}
