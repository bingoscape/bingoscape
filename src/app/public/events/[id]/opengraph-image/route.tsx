import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { getPublicEvent, getPublicBingos, getPublicBingoDetails } = await import("@/app/actions/public-events")
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
          width: 1200,
          height: 630,
        }
      )
    }

    const bingos = await getPublicBingos(params.id)
    const firstBingo = bingos.length > 0 ? await getPublicBingoDetails(bingos[0]!.id) : null

    return new ImageResponse(
      (
        <div
          style={{
            background: "linear-gradient(90deg, #1e293b 0%, #0f172a 100%)",
            width: "100%",
            height: "100%",
            display: "flex",
            color: "white",
          }}
        >
          {/* Left side - Event Information */}
          <div
            style={{
              width: "50%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "60px",
            }}
          >
            <div
              style={{
                fontSize: 40,
                fontWeight: "bold",
                marginBottom: "20px",
                color: "#f8fafc",
                display: "flex",
                lineHeight: 1.2,
              }}
            >
              {event.title}
            </div>

            {event.clanName && (
              <div
                style={{
                  fontSize: 20,
                  marginBottom: "15px",
                  color: "#94a3b8",
                  display: "flex",
                }}
              >
                Hosted by {event.clanName}
              </div>
            )}

            <div
              style={{
                fontSize: 18,
                marginBottom: "30px",
                color: "#cbd5e1",
                display: "flex",
              }}
            >
              {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginBottom: "30px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>🎯</span>
                <span style={{ fontSize: "16px", color: "#e2e8f0" }}>
                  {event.bingoCount > 0 ? `${event.bingoCount} ${event.bingoCount === 1 ? "Bingo" : "Bingos"}` : "0 Bingos"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>💰</span>
                <span style={{ fontSize: "16px", color: "#e2e8f0" }}>
                  {event.minimumBuyIn > 0 ? `${event.minimumBuyIn.toLocaleString()} GP` : "Free"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>🏆</span>
                <span style={{ fontSize: "16px", color: "#e2e8f0" }}>
                  {event.basePrizePool > 0 ? `${event.basePrizePool.toLocaleString()} GP` : "No Prize"}
                </span>
              </div>
            </div>

            <div
              style={{
                fontSize: 14,
                color: "#64748b",
                display: "flex",
              }}
            >
              BingoScape • RuneScape Bingo Events
            </div>
          </div>

          {/* Right side - Bingo Board */}
          <div
            style={{
              width: "50%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
              }}
            >
              {firstBingo ? (
                Array.from({ length: firstBingo.rows }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    style={{
                      display: "flex",
                      gap: "3px",
                    }}
                  >
                    {Array.from({ length: firstBingo.columns }).map((_, colIndex) => {
                      const tileIndex = rowIndex * firstBingo.columns + colIndex
                      const tile = firstBingo.tiles[tileIndex]
                      
                      // Calculate tile size to fit in right half (approximately 550px available)
                      const maxGridWidth = 520
                      const maxGridHeight = 520
                      const tileWidth = Math.min(60, Math.floor(maxGridWidth / firstBingo.columns))
                      const tileHeight = Math.min(60, Math.floor(maxGridHeight / firstBingo.rows))
                      const tileSize = Math.min(tileWidth, tileHeight)
                      
                      return (
                        <div
                          key={colIndex}
                          style={{
                            width: `${tileSize}px`,
                            height: `${tileSize}px`,
                            backgroundColor: "#334155",
                            border: "2px solid #475569",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: `${Math.max(8, tileSize / 8)}px`,
                            fontWeight: "bold",
                            color: "#f1f5f9",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          {tile?.headerImage ? (
                            <img
                              src={tile.headerImage}
                              alt={tile.title}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div style={{ textAlign: "center", padding: "2px" }}>
                              {tile ? tile.title.substring(0, Math.max(4, Math.floor(tileSize / 8))) : "?"}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", gap: "8px" }}>
                    {["B", "I", "N", "G", "O"].map((letter, index) => (
                      <div
                        key={index}
                        style={{
                          width: "70px",
                          height: "70px",
                          backgroundColor: "#334155",
                          border: "2px solid #475569",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "28px",
                          fontWeight: "bold",
                          color: "#f1f5f9",
                        }}
                      >
                        {letter}
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      fontSize: "16px",
                      color: "#94a3b8",
                      marginTop: "10px",
                      display: "flex",
                    }}
                  >
                    Bingo board coming soon!
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (error) {
    console.error('Error generating OpenGraph image:', error)
    
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
          Error Loading Event
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  }
}