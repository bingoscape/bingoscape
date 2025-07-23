import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/server/auth"
import { db } from "@/server/db"
import { submissionComments, submissions, users } from "@/server/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { z } from "zod"

const createCommentSchema = z.object({
  comment: z.string().min(10, "Comment must be at least 10 characters").max(500, "Comment must be at most 500 characters"),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const submissionId = params.id

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

    return NextResponse.json(comments)
  } catch (error) {
    console.error("Error fetching submission comments:", error)
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const submissionId = params.id
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

    // TODO: Add permission check to ensure user can comment on this submission
    // This should check if the user is an admin/management role for the event
    
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
      .where(eq(submissionComments.id, newComment.id))
      
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

    console.error("Error creating submission comment:", error)
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    )
  }
}