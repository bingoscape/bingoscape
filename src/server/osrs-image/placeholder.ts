import { deflateSync, crc32 } from "zlib"

/**
 * The picture served while an image is unavailable (the wiki said 404 or
 * failed and the retry window has not passed): a 16x16 translucent grey PNG,
 * built once at load so it is valid by construction.
 */
const SIZE = 16

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function buildPlaceholder(): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(SIZE, 0)
  header.writeUInt32BE(SIZE, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  // Each scanline: filter byte 0 followed by RGBA pixels.
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array.from({ length: SIZE }, () => [128, 128, 128, 64]).flat()),
  ])
  const raw = Buffer.concat(Array.from({ length: SIZE }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

export const PLACEHOLDER_PNG: Buffer = buildPlaceholder()
export const PLACEHOLDER_CONTENT_TYPE = "image/png"
