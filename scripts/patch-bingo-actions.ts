import fs from 'fs'

const path = 'src/app/actions/bingo.ts'
let content = fs.readFileSync(path, 'utf8')

// 1. Add imports
content = content.replace(
  'teamTierProgress,',
  `teamTierProgress,
  teamRaceStates,
  teamRaceJumps,
  raceActivityLogs,`
)

// 2. Add the Roll & Move function
const rollMoveFn = `
export async function handleTileRaceMove(teamId: string, bingoId: string, completedTileId: string) {
  try {
    const session = await getServerAuthSession()
    if (!session) return { success: false, error: "Not authenticated" }

    return await db.transaction(async (tx) => {
      // 1. Fetch bingo details to get die size and jump settings
      const bingo = await tx.query.bingos.findFirst({
        where: eq(bingos.id, bingoId),
        with: {
          tiles: {
            orderBy: (tiles, { asc }) => [asc(tiles.index)],
          },
        },
      })
      if (!bingo) throw new Error("Bingo not found")

      // Check max tile index to know where finish line is
      const tilesSorted = [...bingo.tiles].sort((a, b) => a.index - b.index)
      if (tilesSorted.length === 0) return { success: false, error: "No tiles configured" }
      const maxIndex = tilesSorted[tilesSorted.length - 1].index

      // 2. Find or create race state
      let state = await tx.query.teamRaceStates.findFirst({
        where: and(eq(teamRaceStates.teamId, teamId), eq(teamRaceStates.bingoId, bingoId)),
      })

      if (!state) {
        const [newState] = await tx.insert(teamRaceStates).values({
          teamId,
          bingoId,
          currentTileIndex: 1,
        }).returning()
        state = newState
      }

      if (state.finished) return { success: true, message: "Team already finished" }

      // 3. Ensure the completed tile is their active tile
      const completedTile = bingo.tiles.find((t) => t.id === completedTileId)
      if (!completedTile || completedTile.index !== state.currentTileIndex) {
        // Just record that a tile was approved, but don't roll if it's not their active tile
        return { success: true, message: "Tile approved but not current active tile" }
      }

      // 4. Generate random roll
      const roll = Math.floor(Math.random() * bingo.dieSize) + 1
      let newIndex = state.currentTileIndex + roll
      let finalIndex = newIndex

      // Log the roll
      const team = await tx.query.teams.findFirst({ where: eq(teams.id, teamId) })
      const teamName = team ? team.name : "Team"

      let activityMsg = \`\${teamName} completed Tile \${state.currentTileIndex} and rolled a \${roll}, landing on Tile \${newIndex}.\`

      // 5. Win Check
      if (newIndex >= maxIndex) {
        finalIndex = maxIndex
        activityMsg = \`\${teamName} rolled a \${roll} and completed the Tile Race! 🎉\`
        await tx.update(teamRaceStates).set({ currentTileIndex: finalIndex, finished: true }).where(eq(teamRaceStates.id, state.id))
        await tx.insert(raceActivityLogs).values({ teamId, bingoId, message: activityMsg })
        return { success: true, finalIndex, finished: true }
      }

      // 6. Jump Check
      const landingTile = bingo.tiles.find((t) => t.index === newIndex)
      if (landingTile && landingTile.jumpToIndex) {
        const jumpTarget = landingTile.jumpToIndex
        const isChute = jumpTarget < newIndex
        const isLadder = jumpTarget > newIndex

        // Check history
        const previousJump = await tx.query.teamRaceJumps.findFirst({
          where: and(
            eq(teamRaceJumps.teamId, teamId),
            eq(teamRaceJumps.bingoId, bingoId),
            eq(teamRaceJumps.jumpedFromIndex, newIndex)
          )
        })

        if (isChute) {
          if (!previousJump) {
            // Take the chute
            finalIndex = jumpTarget
            activityMsg += \` Oh no! They fell down a chute to Tile \${finalIndex}!\`
            await tx.insert(teamRaceJumps).values({ teamId, bingoId, jumpedFromIndex: newIndex })
          } else {
            activityMsg += \` They landed on a chute but safely ignored it since they took it before.\`
          }
        } else if (isLadder) {
          if (bingo.allowMultipleForwardJumps || !previousJump) {
            finalIndex = jumpTarget
            activityMsg += \` Nice! They took a ladder up to Tile \${finalIndex}!\`
            if (!previousJump) {
              await tx.insert(teamRaceJumps).values({ teamId, bingoId, jumpedFromIndex: newIndex })
            }
          } else {
            activityMsg += \` They landed on a ladder but couldn't take it again.\`
          }
        }
      }

      // 7. Save State
      await tx.update(teamRaceStates).set({ currentTileIndex: finalIndex }).where(eq(teamRaceStates.id, state.id))
      await tx.insert(raceActivityLogs).values({ teamId, bingoId, message: activityMsg })

      return { success: true, finalIndex, message: activityMsg }
    })
  } catch (error) {
    logger.error({ error }, "Error handling tile race move")
    return { success: false, error: "Failed to process tile race move" }
  }
}
`

content = content + '\n' + rollMoveFn

// 3. Inject it into updateTeamTileSubmissionStatus
content = content.replace(
  '// TODO: Trigger Roll & Move Engine',
  'await handleTileRaceMove(updatedTeamTileSubmission.teamId, tile.bingoId, tile.id)'
)

fs.writeFileSync(path, content)
