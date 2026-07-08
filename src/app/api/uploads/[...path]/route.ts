import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"

// Canonical absolute path to the uploads directory – used as the trust boundary.
// path.resolve handles OS separators correctly on both Linux and Windows.
const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads")

export async function GET(request: NextRequest) {
  // Strip the /api/uploads/ prefix to get the relative file path supplied by the caller.
  const rawRelative = request.nextUrl.pathname.replace(/^\/api\/uploads\//, "")

  // Reject empty paths or any segment containing a null byte.
  if (!rawRelative || rawRelative.includes("\0")) {
    return new NextResponse("Not found", { status: 404 })
  }

  // Resolve to an absolute path.  path.resolve normalises ".." sequences,
  // so the resulting string reflects the *actual* location on disk.
  const resolvedPath = path.resolve(UPLOADS_DIR, rawRelative)

  // Critical guard: ensure the resolved path is strictly inside UPLOADS_DIR.
  // Adding path.sep prevents a prefix like /public/uploads-evil from matching.
  if (
    resolvedPath !== UPLOADS_DIR &&
    !resolvedPath.startsWith(UPLOADS_DIR + path.sep)
  ) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    const file = await fs.readFile(resolvedPath)
    const contentType = getContentType(resolvedPath)
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return new NextResponse("File not found", { status: 404 })
  }
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".png":
      return "image/png"
    case ".gif":
      return "image/gif"
    default:
      return "application/octet-stream"
  }
}
