import { ImageResponse } from "next/og"
import { getPublicEvent, getPublicBingos, getPublicBingoDetails } from "@/app/actions/public-events"

// Image metadata
export const alt = "BingoScape Event"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

// Image generation
export default async function Image({ params }: { params: { id: string } }) {
  const event = await getPublicEvent(params.id)
  
  if (!event) {
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 48,
            background: "linear-gradient(90deg, #1e293b 0%, #0f172a 100%)",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
          }}
        >
          Event Not Found
        </div>
      ),
      {
        ...size,
      }
    )
  }

  const bingos = await getPublicBingos(params.id)
  const firstBingo = bingos.length > 0 ? await getPublicBingoDetails(bingos[0]!.id) : null

  // Create a simplified bingo grid representation for visual balance

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 32,
          background: "linear-gradient(90deg, #1e293b 0%, #0f172a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          padding: "40px",
        }}
      >
        {/* Header */}
        <div
          style={{
            fontSize: 48,
            fontWeight: "bold",
            marginBottom: "20px",
            textAlign: "center",
            color: "#f8fafc",
          }}
        >
          {event.title}
        </div>

        {/* Event info */}
        <div
          style={{
            fontSize: 24,
            marginBottom: "30px",
            textAlign: "center",
            color: "#94a3b8",
          }}
        >
          {event.clanName && `Hosted by ${event.clanName} • `}
          {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
        </div>

        {/* Bingo grid representation */}
        {firstBingo && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {Array.from({ length: Math.min(firstBingo.rows, 4) }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                style={{
                  display: "flex",
                  gap: "4px",
                }}
              >
                {Array.from({ length: Math.min(firstBingo.columns, 4) }).map((_, colIndex) => {
                  const tileIndex = rowIndex * firstBingo.columns + colIndex
                  const tile = firstBingo.tiles[tileIndex]
                  
                  return (
                    <div
                      key={colIndex}
                      style={{
                        width: "60px",
                        height: "60px",
                        backgroundColor: "#334155",
                        border: "2px solid #475569",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: "#f1f5f9",
                        textAlign: "center",
                        overflow: "hidden",
                      }}
                    >
                      {tile ? (
                        tile.title.length > 10 ? tile.title.substring(0, 8) + "..." : tile.title
                      ) : (
                        "?"
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div
          style={{
            display: "flex",
            marginTop: "30px",
            gap: "40px",
            fontSize: "18px",
            color: "#94a3b8",
          }}
        >
          {event.bingoCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🎯</span>
              <span>{event.bingoCount} {event.bingoCount === 1 ? "Bingo" : "Bingos"}</span>
            </div>
          )}
          {event.minimumBuyIn > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>💰</span>
              <span>{event.minimumBuyIn.toLocaleString()} GP</span>
            </div>
          )}
          {event.basePrizePool > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🏆</span>
              <span>{event.basePrizePool.toLocaleString()} GP</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            fontSize: 16,
            color: "#64748b",
            marginTop: "20px",
          }}
        >
          BingoScape • RuneScape Bingo Events
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}