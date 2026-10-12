"use client"

import { useCallback, useSyncExternalStore } from "react"

interface RememberedChoice<T extends string> {
  /** The remembered value, or `fallback` until one was chosen (always `fallback` during SSR). */
  useValue: () => readonly [value: T, setValue: (value: T) => void]
  /** Forgets the remembered value. */
  reset: () => void
}

/**
 * A choice that outlives the component showing it (the quick-add bar is
 * remounted for every Tile) and the page load: it is kept in `localStorage`
 * under `storageKey`, and in memory where storage is unavailable (private
 * mode, SSR). Built on `useSyncExternalStore`, so server and first client
 * render agree on `fallback` and there is no hydration mismatch.
 */
export function createRememberedChoice<T extends string>(
  storageKey: string,
  values: readonly T[],
  fallback: T
): RememberedChoice<T> {
  const listeners = new Set<() => void>()
  let inMemory: T | null = null

  const isValue = (raw: string | null): raw is T =>
    raw !== null && (values as readonly string[]).includes(raw)

  const read = (): T => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      return isValue(stored) ? stored : fallback
    } catch {
      // Storage is blocked; use the value remembered in memory.
      return inMemory ?? fallback
    }
  }

  const notify = () => listeners.forEach((listener) => listener())

  const write = (value: T) => {
    inMemory = value
    try {
      window.localStorage.setItem(storageKey, value)
    } catch {
      // Storage is blocked; the in-memory value still lasts for the session.
    }
    notify()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    // Another tab changed the choice.
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) listener()
    }
    window.addEventListener("storage", onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener("storage", onStorage)
    }
  }

  function useRememberedValue() {
    const value = useSyncExternalStore(subscribe, read, () => fallback)
    const setValue = useCallback((next: T) => write(next), [])
    return [value, setValue] as const
  }

  return {
    useValue: useRememberedValue,
    reset: () => {
      inMemory = null
      try {
        window.localStorage.removeItem(storageKey)
      } catch {
        // Nothing stored to remove.
      }
      notify()
    },
  }
}
