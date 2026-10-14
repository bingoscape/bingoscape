/**
 * Mutations return `{ success: false, error, code? }` instead of throwing.
 * Asserts that outcome, optionally with a message fragment / pattern and code.
 */
export async function expectFailure(
  outcome: Promise<unknown> | unknown,
  message?: string | RegExp,
  code?: string
): Promise<void> {
  const result = (await outcome) as {
    success?: boolean
    error?: string
    code?: string
  }
  expect(result).toMatchObject({ success: false })
  if (typeof message === "string") expect(result.error).toContain(message)
  else if (message) expect(result.error).toMatch(message)
  if (code) expect(result.code).toBe(code)
}
