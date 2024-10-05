import React from 'react'
import { Button } from "@/components/ui/button"
import { Lock, Unlock, PlusSquare } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface TileOrderingControlsProps {
  isLocked: boolean
  onToggleOrdering: () => void
  onAddRow: () => void
  onAddColumn: () => void
}

export function TileOrderingControls({ isLocked, onToggleOrdering, onAddRow, onAddColumn }: TileOrderingControlsProps) {
  return (
    <div className="flex justify-end items-center space-x-2">
      <AnimatePresence>
        {!isLocked && (
          <>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <Button onClick={onAddRow} variant="outline">
                <PlusSquare className="mr-2 h-4 w-4" />
                <span>Row</span>
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              <Button onClick={onAddColumn} variant="outline">
                <PlusSquare className="mr-2 h-4 w-4" />
                <span>Column</span>
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <Button onClick={onToggleOrdering} variant="outline" size="icon" aria-label={isLocked ? 'Unlock grid' : 'Lock grid'}>
        {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      </Button>
    </div>
  )
}
