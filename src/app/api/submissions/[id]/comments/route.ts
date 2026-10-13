import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { getServerSession } from "next-auth"
import { authOptions } from "@/server/auth"
import { db } from "@/server/db"
import {
  AuthzError,
  requireBingoAdminForSubmission,
  requireSubmissionCommentReader,
} from "@/server/authz"
import { submissionComments, submissions, users } from "@/server/db/schema"
import { eq, desc } from "drizzle-orm"
import { z } from "zod"

const createCommentSchema = z.object({
  comment: z
    .string()
    .min(10, "Comment must be at least 10 characters")
    .max(500, "Comment must be at most 500 characters"),
})

/**
 * Writing comments is a review action: only admin/management of the Event that
 * owns the Submission. The Event is derived from the Submission. Returns an
 * error response when the caller is not allowed.
 */
async function authorizeWrite(submissionId: string): Promise<NextResponse | null> {
  try {
    await requireBingoAdminForSubmission(submissionId)
    return null
  } catch (error) {
    return authzFailure(error)
  }
}

/** Unknown and forbidden Submissions look the same: no enumeration. */
function authzFailure(error: unknown): NextResponse {
  if (!(error instanceof AuthzError)) throw error
  const status = error.message === "Unauthorized" ? 401 : 404
  return NextResponse.json({ error: "Not found" }, { status })
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const submissionId = params.id

    // Managers, and the members of the owning Team, may read the comments.
    let isManager: boolean
    try {
      ;({ isManager } = await requireSubmissionCommentReader(submissionId))
    } catch (error) {
      return authzFailure(error)
    }

    // Fetch comments for the submission
    const comments = await db
      .select({
        id: submissionComments.id,
        submissionId: submissionComments.submissionId,
        comment: submissionComments.comment,
        createdAt: submissionComments.createdAt,
        updatedAt: submissionComments.updatedAt,
        author: {
          id: users.id,
          name: users.name,
          runescapeName: users.runescapeName,
        },
      })
      .from(submissionComments)
      .innerJoin(users, eq(submissionComments.authorId, users.id))
      .where(eq(submissionComments.submissionId, submissionId))
      .orderBy(desc(submissionComments.createdAt))

    // Players see who reviewed them by in-game name only.
    return NextResponse.json(
      isManager
        ? comments
        : comments.map((comment) => ({
            ...comment,
            author: {
              id: "",
              name: null,
              runescapeName: comment.author.runescapeName,
            },
          }))
    )
  } catch (error) {
    logger.error({ error }, "Error fetching submission comments")
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const submissionId = params.id

    const denied = await authorizeWrite(submissionId)
    if (denied) return denied

    const body = await request.json()

    // Validate request body
    const validatedData = createCommentSchema.parse(body)

    // Check if submission exists and get the associated event
    const submission = await db
      .select({
        id: submissions.id,
        teamTileSubmission: {
          teamId: submissions.teamTileSubmissionId,
        },
      })
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1)

    if (submission.length === 0) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      )
    }

    // Create the comment
    const [newComment] = await db
      .insert(submissionComments)
      .values({
        submissionId,
        authorId: session.user.id,
        comment: validatedData.comment,
      })
      .returning()

    // Fetch the complete comment with author info
    const commentWithAuthor = await db
      .select({
        id: submissionComments.id,
        submissionId: submissionComments.submissionId,
        comment: submissionComments.comment,
        createdAt: submissionComments.createdAt,
        updatedAt: submissionComments.updatedAt,
        author: {
          id: users.id,
          name: users.name,
          runescapeName: users.runescapeName,
        },
      })
      .from(submissionComments)
      .innerJoin(users, eq(submissionComments.authorId, users.id))
      .where(eq(submissionComments.id, newComment!.id))

    if (commentWithAuthor.length === 0) {
      return NextResponse.json(
        { error: "Failed to retrieve created comment" },
        { status: 500 }
      )
    }

    return NextResponse.json(commentWithAuthor[0], { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    logger.error({ error }, "Error creating submission comment")
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    )
  }
}
