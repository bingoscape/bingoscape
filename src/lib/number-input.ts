import { validateTargetValue } from "@/lib/goal-validation"

/** Result of reading what a user typed into a number field. */
export type ParsedNumber =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "number"; value: number }

const SUFFIX_MULTIPLIER: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
}

// Optional sign, digits with an optional fraction, optional k/m/b suffix.
const NUMBER_PATTERN = /^(-?)(\d+(?:\.\d*)?|\.\d+)([kmb])?$/
// Commas are only accepted as thousands separators ("13,034,431"), so a
// decimal comma ("2,5m") is rejected instead of silently read as 25m.
const THOUSANDS_PATTERN = /^\d{1,3}(?:,\d{3})+(?:\.\d*)?$/

/**
 * Reads a number the way players write it: plain digits, thousands separators
 * ("13,034,431") and the shorthand "500k", "1m", "2.5m", "1b".
 *
 * Fractions are allowed here (so "1.5" is reported as 1.5, not "invalid");
 * callers decide whether the value is acceptable, see `validateNumberInput`.
 */
export function parseNumberInput(raw: string): ParsedNumber {
  const cleaned = raw.toLowerCase().replace(/[\s_]/g, "")
  if (cleaned === "") return { kind: "empty" }

  const match = NUMBER_PATTERN.exec(cleaned.replace(/,/g, ""))
  if (!match) return { kind: "invalid" }

  const [, sign, mantissa, suffix] = match
  if (mantissa === undefined) return { kind: "invalid" }

  if (cleaned.includes(",")) {
    const withoutSuffix = suffix ? cleaned.slice(0, -1) : cleaned
    if (!THOUSANDS_PATTERN.test(withoutSuffix.replace(/^-/, ""))) {
      return { kind: "invalid" }
    }
  }

  const multiplier = suffix ? (SUFFIX_MULTIPLIER[suffix] ?? 1) : 1
  // Round away floating point noise (2.55k is 2550, not 2549.9999999999995).
  const value = Math.round(Number(mantissa) * multiplier * 1e6) / 1e6

  return { kind: "number", value: sign === "-" ? -value : value }
}

/**
 * Returns an error message for a typed target value, or null when it is a
 * whole number `validate` accepts. Defaults to the goal target rules
 * (1 to 2,147,483,647).
 */
export function validateNumberInput(
  raw: string,
  validate: (value: number) => string | null = validateTargetValue
): string | null {
  const parsed = parseNumberInput(raw)
  if (parsed.kind === "empty") return "Enter a number"
  if (parsed.kind === "invalid") {
    return "Enter a whole number, like 500000, 500k or 2.5m"
  }
  return validate(parsed.value)
}

/** The numeric value of a typed target, or null when it is not valid. */
export function parseTargetInput(raw: string): number | null {
  const parsed = parseNumberInput(raw)
  if (parsed.kind !== "number") return null
  return validateNumberInput(raw) === null ? parsed.value : null
}

/** 13034431 -> "13,034,431" (fixed locale so server and client agree). */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-US")
}

/**
 * "= 500,000 XP" style preview of a typed value, or null when the input is not
 * a valid target. `unitSingular` is used for a value of exactly 1.
 */
export function formatNumberPreview(
  raw: string,
  unit?: string,
  unitSingular?: string
): string | null {
  const value = parseTargetInput(raw)
  if (value === null) return null
  const label = value === 1 ? (unitSingular ?? unit) : unit
  return `= ${formatNumber(value)}${label ? ` ${label}` : ""}`
}
