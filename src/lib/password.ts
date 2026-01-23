import bcrypt from "bcryptjs"

/**
 * Number of salt rounds for bcrypt hashing.
 * 12 rounds provides a good balance between security and performance.
 * Each additional round doubles the computation time.
 */
const SALT_ROUNDS = 12

/**
 * Hash a plaintext password using bcrypt.
 *
 * @param password - The plaintext password to hash
 * @returns Promise resolving to the hashed password
 * @throws Error if password is empty or hashing fails
 *
 * @example
 * const hashedPassword = await hashPassword("mySecurePassword123")
 * // Store hashedPassword in database
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error("Password cannot be empty")
  }

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS)
    const hash = await bcrypt.hash(password, salt)
    return hash
  } catch (error) {
    console.error("Failed to hash password:", error)
    throw new Error("Failed to hash password")
  }
}

/**
 * Verify a plaintext password against a bcrypt hash.
 *
 * @param password - The plaintext password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns Promise resolving to true if password matches, false otherwise
 *
 * @example
 * const isValid = await verifyPassword("userInput", storedHash)
 * if (isValid) {
 *   // Password is correct, allow login
 * }
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!password || !hash) {
    return false
  }

  try {
    const isValid = await bcrypt.compare(password, hash)
    return isValid
  } catch (error) {
    // Log error in production but don't expose details
    console.error("Password verification error:", error)
    return false
  }
}
