import { type NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

export async function GET(request: NextRequest) {
	const pathname = request.nextUrl.pathname
	const filePath = path.join(process.cwd(), 'public', pathname)

	try {
		const file = await fs.readFile(filePath)
		const contentType = getContentType(filePath)
		return new NextResponse(file, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		})
	} catch (_) {
		return new NextResponse('File not found', { status: 404 })
	}
}

function getContentType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase()
	switch (ext) {
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg'
		case '.png':
			return 'image/png'
		case '.gif':
			return 'image/gif'
		default:
			return 'application/octet-stream'
	}
}

