import { ImageResponse } from "next/og"
import { logger } from "@/lib/logger"
import { getInlineImageSrc } from "@/server/osrs-image/inline"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const { getPublicEvent, getPublicBingos, getPublicBingoDetails } =
      await import("@/app/actions/public-events")
    const event = await getPublicEvent(params.id)

    if (!event) {
      return new ImageResponse(
        <div
          style={{
            fontSize: 48,
            background:
              "linear-gradient(135deg, #3e3529 0%, #2b2418 50%, #1c170f 100%)",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
          }}
        >
          Event Not Found
        </div>,
        {
          width: 1200,
          height: 630,
        }
      )
    }

    const bingos = await getPublicBingos(params.id)
    const firstBingo =
      bingos.length > 0 ? await getPublicBingoDetails(bingos[0]!.id) : null

    // Satori fetches `<img src>` itself: serve wiki images from the cache as
    // data URIs (null: not available, the tile shows its title instead).
    const tileImages = new Map<string, string | null>()
    if (firstBingo) {
      const urls = new Set(
        firstBingo.tiles.flatMap((tile) =>
          tile.headerImage ? [tile.headerImage] : []
        )
      )
      await Promise.all(
        [...urls].map(async (url) =>
          tileImages.set(url, await getInlineImageSrc(url))
        )
      )
    }

    return new ImageResponse(
      <div
        style={{
          background:
            "linear-gradient(135deg, #3e3529 0%, #2b2418 50%, #1c170f 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          color: "white",
          position: "relative",
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
              fontSize: 52,
              fontWeight: "bold",
              marginBottom: "20px",
              color: "#ff981f",
              display: "flex",
              lineHeight: 1.2,
              textShadow: "2px 2px 0 #000",
            }}
          >
            {event.title}
          </div>

          {event.clanName && (
            <div
              style={{
                fontSize: 22,
                marginBottom: "15px",
                color: "#d8c9a0",
                display: "flex",
                fontWeight: "500",
              }}
            >
              Hosted by {event.clanName}
            </div>
          )}

          <div
            style={{
              fontSize: 20,
              marginBottom: "30px",
              color: "#d8c9a0",
              display: "flex",
              fontWeight: "500",
            }}
          >
            {new Date(event.startDate).toLocaleDateString()} -{" "}
            {new Date(event.endDate).toLocaleDateString()}
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
              <span
                style={{
                  fontSize: "18px",
                  color: "#d8c9a0",
                  fontWeight: "600",
                }}
              >
                {event.bingoCount > 0
                  ? `${event.bingoCount} ${event.bingoCount === 1 ? "Bingo" : "Bingos"}`
                  : "0 Bingos"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>💰</span>
              <span
                style={{
                  fontSize: "18px",
                  color: event.minimumBuyIn > 0 ? "#ffff00" : "#00ff00",
                  fontWeight: "700",
                  textShadow: "1px 1px 0 #000",
                }}
              >
                {event.minimumBuyIn > 0
                  ? `${event.minimumBuyIn.toLocaleString()} GP`
                  : "Free"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>🏆</span>
              <span
                style={{
                  fontSize: "18px",
                  color: event.basePrizePool > 0 ? "#ffff00" : "#d8c9a0",
                  fontWeight: "700",
                  textShadow: "1px 1px 0 #000",
                }}
              >
                {event.basePrizePool > 0
                  ? `${event.basePrizePool.toLocaleString()} GP`
                  : "No Prize"}
              </span>
            </div>
          </div>

          <div
            style={{
              fontSize: 16,
              color: "#b8a77a",
              display: "flex",
              fontWeight: "500",
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
            padding: "5px",
            position: "relative",
          }}
        >
          {/* Subtle overlay for better text contrast */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "linear-gradient(45deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)",
              zIndex: 1,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
              position: "relative",
              zIndex: 2,
            }}
          >
            {firstBingo ? (
              Array.from({ length: firstBingo.rows }).map((_, rowIndex) => (
                <div
                  key={rowIndex}
                  style={{
                    display: "flex",
                    gap: "2px",
                  }}
                >
                  {Array.from({ length: firstBingo.columns }).map(
                    (_, colIndex) => {
                      const tileIndex = rowIndex * firstBingo.columns + colIndex
                      const tile = firstBingo.tiles[tileIndex]

                      // Calculate tile size with right margin space (580px available width, 620px height)
                      const maxGridWidth = 580
                      const maxGridHeight = 620
                      const tileWidth = Math.floor(
                        maxGridWidth / firstBingo.columns
                      )
                      const tileHeight = Math.floor(
                        maxGridHeight / firstBingo.rows
                      )
                      const tileSize = Math.min(tileWidth, tileHeight)

                      return (
                        <div
                          key={colIndex}
                          style={{
                            width: `${tileSize}px`,
                            height: `${tileSize}px`,
                            backgroundColor: "#4b4132",
                            border: "1px solid #1c170f",
                            borderRadius: "3px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: `${Math.max(8, tileSize / 12)}px`,
                            fontWeight: "bold",
                            color: "#d8c9a0",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          {tile?.headerImage &&
                          tileImages.get(tile.headerImage) ? (
                            // oxlint-disable-next-line next/no-img-element -- rendered by Satori (ImageResponse), where next/image is unsupported
                            <img
                              src={tileImages.get(tile.headerImage) ?? undefined}
                              alt={tile.title}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                              }}
                            />
                          ) : (
                            <div
                              style={{ textAlign: "center", padding: "1px" }}
                            >
                              {tile
                                ? tile.title.substring(
                                  0,
                                  Math.max(4, Math.floor(tileSize / 12))
                                )
                                : "?"}
                            </div>
                          )}
                        </div>
                      )
                    }
                  )}
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
                        width: "100px",
                        height: "100px",
                        backgroundColor: "#4b4132",
                        border: "2px solid #1c170f",
                        borderRadius: "2px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "40px",
                        fontWeight: "bold",
                        color: "#d8c9a0",
                      }}
                    >
                      {letter}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: "20px",
                    color: "#b8a77a",
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
      </div>,
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (error) {
    logger.error({ error }, "Error generating OpenGraph image")

    return new ImageResponse(
      <div
        style={{
          fontSize: 48,
          background:
            "linear-gradient(135deg, #3e3529 0%, #2b2418 50%, #1c170f 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        Error Loading Event
      </div>,
      {
        width: 1200,
        height: 630,
      }
    )
  }
}
