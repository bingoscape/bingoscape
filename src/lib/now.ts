/**
 * The current time, for Server Components. They render once per request, so
 * reading the clock is fine there; the `react/purity` lint rule only knows
 * "during render" and cannot tell. Client Components must not use this: take
 * `now` from the server or from a `useState` initializer instead.
 */
export function getNow(): Date {
  return new Date()
}
