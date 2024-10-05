import React from 'react'

interface CodephraseDisplayProps {
  codephrase: string
}

export function CodephraseDisplay({ codephrase }: CodephraseDisplayProps) {
  return (
    <div className="bg-primary text-primary-foreground p-4 rounded-lg shadow-md mb-6">
      <h2 className="text-2xl font-bold mb-2">Codephrase</h2>
      <p className="text-xl">{codephrase}</p>
    </div>
  )
}
