/** True when keystrokes belong to a text field rather than a page shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return (
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      !!el.isContentEditable)
  )
}

/** True while a modal dialog is open, which owns the keyboard. */
export function isDialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"]')
}

/** True when an open menu or listbox (a popup that closes on Esc) has focus. */
function isInsidePopup(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el?.closest?.('[role="menu"], [role="listbox"]')
}

/**
 * Whether a bare-key page shortcut should fire for this event: not while
 * typing, not in a dialog or popup, and not if something already handled it.
 */
export function shouldHandlePageShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return false
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  if (isTypingTarget(event.target)) return false
  if (isInsidePopup(event.target)) return false
  return !isDialogOpen()
}
