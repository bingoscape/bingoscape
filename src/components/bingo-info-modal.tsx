'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Info } from 'lucide-react'
import { type Bingo } from '@/app/actions/events'
import { CodephraseDisplay } from './codephrase-display'

interface BingoInfoModalProps {
  bingo: Bingo
}

export function BingoInfoModal({ bingo }: BingoInfoModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Info className="h-4 w-4" />
          <span className="sr-only">Bingo Information</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{bingo.title}</DialogTitle>
          <DialogDescription>Bingo Details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold">Description</h4>
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{bingo.description}</pre>
          </div>
          <div>
            <h4 className="font-semibold">Dimensions</h4>
            <p>{bingo.rows} rows x {bingo.columns} columns</p>
          </div>
          <div>
            <h4 className="font-semibold">Codephrase</h4>
            <p>{bingo.codephrase}</p>
          </div>
          {bingo.createdAt && (
            <div>
              <h4 className="font-semibold">Created At</h4>
              <p>{new Date(bingo.createdAt).toLocaleString()}</p>
            </div>
          )}
          <CodephraseDisplay codephrase={bingo.codephrase} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
