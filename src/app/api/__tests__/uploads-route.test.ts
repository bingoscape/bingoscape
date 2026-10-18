/**
 * @jest-environment node
 */
import fs from "fs/promises"
import path from "path"
import { NextRequest } from "next/server"

import { READ_DECISIONS } from "@/lib/authz/read-policy"
import { GET } from "@/app/api/uploads/[...path]/route"
import { getServerAuthSession } from "@/server/auth"
import {
  createReadFixture,
  type ReadFixture,
} from "@/server/__tests__/helpers/read-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

const session = getServerAuthSession as jest.Mock

let fx: ReadFixture

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads")
const nameOf = (imagePath: string) => imagePath.replace(/^\/uploads\//, "")

beforeAll(async () => {
  fx = await createReadFixture()
  // The route reads real files; /public/uploads is not tracked by git.
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  for (const imagePath of [fx.imagePath, fx.hiddenImagePath]) {
    await fs.writeFile(path.join(UPLOADS_DIR, nameOf(imagePath)), "image-bytes")
  }
})

afterAll(async () => {
  for (const imagePath of [fx.imagePath, fx.hiddenImagePath]) {
    await fs.rm(path.join(UPLOADS_DIR, nameOf(imagePath)), { force: true })
  }
  await fx.cleanup()
})

afterEach(() => {
  READ_DECISIONS.uploads = "follow-event-visibility"
})

async function fetchUpload(imagePath: string, userId: string | null) {
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)
  return GET(
    new NextRequest(`http://localhost/api/uploads/${nameOf(imagePath)}`)
  )
}

describe("GET /api/uploads", () => {
  it("serves a Submission image to anybody holding the URL in public-url mode (decision 4)", async () => {
    READ_DECISIONS.uploads = "public-url"
    const response = await fetchUpload(fx.imagePath, null)
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable"
    )
  })

  describe("when images follow the Event's visibility (the default)", () => {

    it("does not serve them to anonymous callers and outsiders", async () => {
      expect((await fetchUpload(fx.imagePath, null)).status).toBe(404)
      expect((await fetchUpload(fx.imagePath, fx.users.outsider)).status).toBe(
        404
      )
    })

    it("serves them to participants, privately cached", async () => {
      const response = await fetchUpload(fx.imagePath, fx.users.memberB)
      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toContain("private")
    })

    it("keeps the images of a hidden Tile for managers", async () => {
      expect(
        (await fetchUpload(fx.hiddenImagePath, fx.users.memberA)).status
      ).toBe(404)
      expect(
        (await fetchUpload(fx.hiddenImagePath, fx.users.management)).status
      ).toBe(200)
    })

    it("still refuses paths outside the uploads directory", async () => {
      session.mockResolvedValue({ user: { id: fx.users.admin } })
      const response = await GET(
        new NextRequest("http://localhost/api/uploads/..%2f..%2fpackage.json")
      )
      expect(response.status).toBe(404)
    })
  })
})
