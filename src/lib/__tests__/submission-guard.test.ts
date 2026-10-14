/**
 * @jest-environment node
 */
import {
  ALLOWED_SUBMISSION_MIME_TYPES,
  MAX_SUBMISSION_FILE_SIZE,
  SubmissionRejectedError,
  assertCanSubmit,
} from "@/lib/submission-guard"

const png = { type: "image/png", size: 1024 }

function rejection(fn: () => void): SubmissionRejectedError {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(SubmissionRejectedError)
    return error as SubmissionRejectedError
  }
  throw new Error("expected assertCanSubmit to throw")
}

describe("assertCanSubmit", () => {
  it.each(ALLOWED_SUBMISSION_MIME_TYPES)("accepts %s on an open Board", (type) => {
    expect(() =>
      assertCanSubmit({ board: { locked: false }, file: { type, size: 10 } })
    ).not.toThrow()
  })

  it("accepts a file of exactly the maximum size", () => {
    expect(() =>
      assertCanSubmit({
        board: { locked: false },
        file: { type: "image/png", size: MAX_SUBMISSION_FILE_SIZE },
      })
    ).not.toThrow()
  })

  it("refuses a locked Board with 403", () => {
    const error = rejection(() =>
      assertCanSubmit({ board: { locked: true }, file: png })
    )
    expect(error).toMatchObject({ code: "BOARD_LOCKED", status: 403 })
    expect(error.message).toBe("This bingo is locked. No submission possible")
  })

  it("lets a manager submit on a locked Board only when the caller opts in", () => {
    expect(() =>
      assertCanSubmit({
        board: { locked: true },
        file: png,
        managerOverridesLock: true,
      })
    ).not.toThrow()
    expect(() =>
      assertCanSubmit({
        board: { locked: true },
        file: png,
        managerOverridesLock: false,
      })
    ).toThrow(SubmissionRejectedError)
  })

  it.each(["image/svg+xml", "application/pdf", "text/html", "image/bmp", ""])(
    "refuses the type %p with 400",
    (type) => {
      expect(
        rejection(() =>
          assertCanSubmit({
            board: { locked: false },
            file: { type, size: 10 },
          })
        )
      ).toMatchObject({ code: "INVALID_FILE_TYPE", status: 400 })
    }
  )

  it("refuses a file over the size limit with 400", () => {
    expect(
      rejection(() =>
        assertCanSubmit({
          board: { locked: false },
          file: { type: "image/png", size: MAX_SUBMISSION_FILE_SIZE + 1 },
        })
      )
    ).toMatchObject({ code: "FILE_TOO_LARGE", status: 400 })
  })

  it("reports a locked Board before a bad file", () => {
    expect(
      rejection(() =>
        assertCanSubmit({
          board: { locked: true },
          file: { type: "text/html", size: 10 },
        })
      ).code
    ).toBe("BOARD_LOCKED")
  })
})
