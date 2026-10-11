import type { ActionResult } from "./confirm-destructive-dialog"

/**
 * The super-admin server actions throw on failure. Views turn that into the
 * `{ success, error }` shape so dialogs can show it inline instead of crashing.
 */
export async function runAdminAction(
  action: () => Promise<unknown>,
  failureMessage: string
): Promise<ActionResult> {
  try {
    await action()
    return { success: true }
  } catch {
    return { success: false, error: failureMessage }
  }
}
