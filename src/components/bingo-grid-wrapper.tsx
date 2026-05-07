"use client"

import { useBoardState } from "@/hooks/use-board-state"
import BingoGrid from "@/components/bingogrid"
import { Button } from "@/components/ui/button"
import { Lock, Unlock, PlusSquare, MinusSquare } from "lucide-react"
import type { Bingo, Team, EventRole } from "@/app/actions/events"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "next/navigation"

interface BingoGridWrapperProps {
  bingo: Bingo
  userRole: EventRole
  teams: Team[]
  currentTeamId: string | undefined
  gameType: "osrs" | "rs3"
}

export default function BingoGridWrapper({
  bingo: initialBingo,
  userRole,
  teams,
  currentTeamId,
  gameType,
}: BingoGridWrapperProps) {
  const {
    bingo,
    isLayoutLocked,
    highlightedTiles,
    handleToggleLock,
    handleAddRow,
    handleAddColumn,
    handleDeleteRow,
    handleDeleteColumn,
    handleReorderTiles,
    updateTileLocally,
    removeTile,
    highlightTilesToDelete,
    clearHighlightedTiles,
  } = useBoardState(initialBingo)

  const searchParams = useSearchParams()
  const selectedTeamId = searchParams?.get("teamId") ?? currentTeamId
  const isManagement = userRole === "admin" || userRole === "management"

  return (
    <div className="space-y-4">
      {isManagement && (
        <div className="mb-4 flex flex-wrap gap-4">
          <Button
            onClick={handleToggleLock}
            className="flex items-center justify-center"
          >
            {isLayoutLocked ? (
              <Unlock className="mr-2 h-4 w-4" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            {isLayoutLocked ? "Unlock Board" : "Lock Board"}
          </Button>
          <AnimatePresence>
            {!isLayoutLocked && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex gap-2"
              >
                <div className="flex-col-1 flex gap-2">
                  <Button
                    onClick={handleAddRow}
                    className="flex items-center justify-center"
                  >
                    <PlusSquare className="mr-2 h-4 w-4" />
                    Row
                  </Button>
                  <Button
                    onClick={handleDeleteRow}
                    onMouseEnter={() => highlightTilesToDelete("row")}
                    onMouseLeave={clearHighlightedTiles}
                    className="flex items-center justify-center"
                  >
                    <MinusSquare className="mr-2 h-4 w-4" />
                    Row
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddColumn}
                    className="flex items-center justify-center"
                  >
                    <PlusSquare className="mr-2 h-4 w-4" />
                    Column
                  </Button>
                  <Button
                    onClick={handleDeleteColumn}
                    onMouseEnter={() => highlightTilesToDelete("column")}
                    onMouseLeave={clearHighlightedTiles}
                    className="flex items-center justify-center"
                  >
                    <MinusSquare className="mr-2 h-4 w-4" />
                    Column
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <BingoGrid
        key={bingo.id}
        bingo={bingo}
        userRole={userRole}
        currentTeamId={selectedTeamId}
        teams={teams}
        gameType={gameType}
        isLayoutLocked={isLayoutLocked}
        onReorderTiles={handleReorderTiles}
        highlightedTiles={highlightedTiles}
        onTileUpdated={updateTileLocally}
        onTileDeleted={removeTile}
      />
    </div>
  )
}
