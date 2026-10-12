import { useEffect } from "react"
import type { RefObject } from "react"

/**
 * cmdk only sets `aria-activedescendant` on its input for a highlight it moved
 * itself, not for the one a controlled `value` passes in. Point the input at the
 * highlighted option here, so screen readers announce the result Enter would pick.
 *
 * `results` is the rendered list (a new array when the options change) and
 * `enabled` is whether the list is on screen.
 */
export function useCmdkActiveDescendant(
  inputRef: RefObject<HTMLInputElement | null>,
  listRef: RefObject<HTMLElement | null>,
  activeKey: string,
  results: readonly unknown[],
  enabled: boolean
) {
  useEffect(() => {
    const field = inputRef.current
    if (!field) return
    const option = enabled
      ? Array.from(
          listRef.current?.querySelectorAll<HTMLElement>("[cmdk-item]") ?? []
        ).find((el) => el.getAttribute("data-value") === activeKey)
      : undefined
    if (option?.id) field.setAttribute("aria-activedescendant", option.id)
    else field.removeAttribute("aria-activedescendant")
  }, [inputRef, listRef, activeKey, results, enabled])
}
