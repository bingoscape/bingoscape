import { MAX_GOALS_PER_BATCH } from "@/lib/goal-validation"
import { parseNumberInput, validateNumberInput } from "@/lib/number-input"

/**
 * Reads a pasted list of items ("3x Dragon bones", "Abyssal whip", ...) into
 * names and quantities. Pure text work: it does not know which names are real
 * items, so wherever a line can be read two ways it returns both and lets the
 * resolver (`resolveOsrsItemNames`) pick the one that names an item.
 *
 * Rules
 * - One entry per line. Blank lines and bullets (`-`, `*`, `•`, `[ ]`) and
 *   numbering (`1.`, `2)`) in front of a line are ignored.
 * - Within a line, commas (outside parentheses, and not thousands separators
 *   like `1,000`) and tabs separate further entries, so a spreadsheet row
 *   `Dragon bones<TAB>3` and `Abyssal whip, Dragon warhammer` both work. A
 *   piece that is only a number is the quantity of its neighbour:
 *   `Dragon bones, 3` and `3, Dragon bones` are one entry each.
 * - A quantity is a whole number from 1 up, with the shorthand `1k`, `2.5m`.
 *   Recognised forms, checked in this order (the first that fits wins):
 *   1. `3x Dragon bones`, `3 x Dragon bones`, `3xDragon bones`
 *   2. `Dragon bones x3`, `Dragon bones x 3`
 *   3. `Dragon bones (3)`, `Dragon bones (x3)`, also without the space
 *   4. `Dragon bones: 3`
 *   5. `3 Dragon bones`: a leading number counts only when it is followed by
 *      a space and a word that starts with a letter, so `3rd age longsword`
 *      and `1/3rds full jug` stay names.
 *   6. `Dragon bones 3`: read as a name first (so `Amulet of glory 4`, the
 *      4-charge amulet, stays one), with the quantity reading as alternative.
 * - Item names contain digits and parentheses (`Amulet of glory(4)`,
 *   `Dragon dagger(p++)`, `Super combat potion (4)`). `(p++)` is not a number
 *   so it is never touched, but `(4)` is ambiguous: the primary reading is a
 *   quantity of 4, with the whole text as alternative. The resolver prefers
 *   the reading whose name is an exact item, so `Amulet of glory(4)` resolves
 *   to the 4-charge amulet while `Dragon bones (3)` resolves to 3 Dragon bones.
 *   On a tie the quantity reading (the primary) wins.
 * - Capped at `MAX_LIST_ENTRIES` entries, the server batch limit. Entries
 *   beyond it and names longer than `MAX_ITEM_NAME_LENGTH` are counted in
 *   `ignored`.
 */

/** Same as the most goals one batch may create. */
export const MAX_LIST_ENTRIES = MAX_GOALS_PER_BATCH
/** Longest item name the resolver accepts (the longest real one has 98 characters). */
export const MAX_ITEM_NAME_LENGTH = 100

/** One way to read a piece of the list. */
export interface ListInterpretation {
  name: string
  quantity: number
}

export interface ParsedListEntry extends ListInterpretation {
  /** The text this entry came from (a line, or one piece of a line). */
  raw: string
  /** Other readings of `raw`, tried by the resolver when the primary one is not an item. */
  alternatives: ListInterpretation[]
}

export interface ParsedItemList {
  entries: ParsedListEntry[]
  /** Entries dropped for being over the cap or having a name that is too long. */
  ignored: number
}

// Digits with optional thousands commas, an optional fraction and an optional
// k / m / b suffix. Validity (whole, positive, in range) is checked afterwards.
const NUMBER = String.raw`\d[\d,]*(?:\.\d+)?[kmb]?`
const TIMES = "[x×]"

const LEADING_TIMES = new RegExp(`^(${NUMBER})${TIMES}(\\s*)(\\S.*)$`, "i")
const LEADING_SPACED_TIMES = new RegExp(
  `^(${NUMBER})\\s+${TIMES}\\s+(\\S.*)$`,
  "i"
)
const TRAILING_TIMES = new RegExp(`^(.*\\S)\\s+${TIMES}\\s*(${NUMBER})$`, "i")
const PAREN_QUANTITY = new RegExp(
  `^(.*\\S)\\s*\\(\\s*${TIMES}?\\s*(${NUMBER})\\s*\\)$`,
  "i"
)
const COLON_QUANTITY = new RegExp(`^(.*\\S)\\s*:\\s*(${NUMBER})$`, "i")
const LEADING_NUMBER = new RegExp(`^(${NUMBER})\\s+(\\p{L}.*)$`, "iu")
const TRAILING_NUMBER = new RegExp(`^(.*\\S)\\s+(${NUMBER})$`, "i")
const BULLET = /^\s*(?:[-*•·▪◦‣–—]|\d{1,3}[.)])\s+/
const CHECKBOX = /^\[[ xX]?\]\s*/

/** The number a typed quantity stands for, or null when it is not a valid goal target. */
function toQuantity(raw: string): number | null {
  if (validateNumberInput(raw) !== null) return null
  const parsed = parseNumberInput(raw)
  return parsed.kind === "number" ? parsed.value : null
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“”]+|["“”]+$/g, "")
    .trim()
}

interface Piece extends ParsedListEntry {
  /** Whether the text itself stated a quantity (so a neighbouring number does not replace it). */
  explicit: boolean
}

function makePiece(
  raw: string,
  name: string,
  quantity: number,
  explicit: boolean,
  alternatives: ListInterpretation[] = []
): Piece {
  return {
    raw,
    name: cleanName(name),
    quantity,
    explicit,
    alternatives: alternatives
      .map((alt) => ({ name: cleanName(alt.name), quantity: alt.quantity }))
      .filter((alt) => alt.name !== ""),
  }
}

/** Reads one piece of text (no separators in it) with the rules in the file comment. */
function interpretPiece(text: string): Piece {
  const whole = { name: text, quantity: 1 }

  let match = LEADING_SPACED_TIMES.exec(text)
  if (match) {
    const quantity = toQuantity(match[1] ?? "")
    if (quantity !== null) {
      return makePiece(text, match[2] ?? "", quantity, true)
    }
  }

  match = LEADING_TIMES.exec(text)
  if (match) {
    const quantity = toQuantity(match[1] ?? "")
    if (quantity !== null) {
      // "3xerician hat" could be a name; "3x Dragon bones" cannot.
      const attached = (match[2] ?? "") === ""
      return makePiece(
        text,
        match[3] ?? "",
        quantity,
        true,
        attached ? [whole] : []
      )
    }
  }

  match = TRAILING_TIMES.exec(text)
  if (match) {
    const quantity = toQuantity(match[2] ?? "")
    if (quantity !== null)
      return makePiece(text, match[1] ?? "", quantity, true)
  }

  match = PAREN_QUANTITY.exec(text)
  if (match) {
    const quantity = toQuantity(match[2] ?? "")
    // "Amulet of glory(4)" is the 4-charge amulet, "Dragon bones (3)" is 3 bones.
    if (quantity !== null) {
      return makePiece(text, match[1] ?? "", quantity, true, [whole])
    }
  }

  match = COLON_QUANTITY.exec(text)
  if (match) {
    const quantity = toQuantity(match[2] ?? "")
    if (quantity !== null)
      return makePiece(text, match[1] ?? "", quantity, true)
  }

  match = LEADING_NUMBER.exec(text)
  if (match) {
    const quantity = toQuantity(match[1] ?? "")
    if (quantity !== null) {
      return makePiece(text, match[2] ?? "", quantity, true, [whole])
    }
  }

  match = TRAILING_NUMBER.exec(text)
  if (match) {
    const quantity = toQuantity(match[2] ?? "")
    // "Amulet of glory 4" first as a name, "Dragon bones 3" as the fallback.
    if (quantity !== null) {
      return makePiece(text, text, 1, false, [
        { name: match[1] ?? "", quantity },
      ])
    }
  }

  return makePiece(text, text, 1, false)
}

/**
 * Splits a line at commas (outside parentheses, and not thousands separators)
 * and tabs.
 */
function splitPieces(line: string): string[] {
  const pieces: string[] = []
  let depth = 0
  let current = ""
  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i)
    if (char === "(") depth++
    else if (char === ")") depth = Math.max(0, depth - 1)

    const isThousands =
      char === "," &&
      /\d/.test(line.charAt(i - 1)) &&
      /^\d{3}(?!\d)/.test(line.slice(i + 1))
    if (depth === 0 && !isThousands && (char === "," || char === "\t")) {
      pieces.push(current)
      current = ""
    } else {
      current += char
    }
  }
  pieces.push(current)
  return pieces.map((piece) => piece.trim()).filter((piece) => piece !== "")
}

function stripLeadIn(line: string): string {
  let text = line.replace(/ /g, " ")
  // A bullet, then maybe a checkbox: "- [ ] Abyssal whip", "1. - Abyssal whip".
  for (let i = 0; i < 2; i++) text = text.replace(BULLET, "")
  return text.replace(CHECKBOX, "").trim()
}

function parseLine(line: string): Piece[] {
  const text = stripLeadIn(line)
  if (!/[\p{L}\p{N}]/u.test(text)) return []

  const pieces: Piece[] = []
  let pendingQuantity: number | null = null
  for (const part of splitPieces(text)) {
    const quantity = toQuantity(part)
    if (quantity !== null) {
      // A piece that is only a number belongs to its neighbour.
      const previous = pieces.at(-1)
      if (previous && !previous.explicit) {
        previous.quantity = quantity
        previous.explicit = true
        previous.alternatives = []
        previous.raw = `${previous.raw}, ${part}`
      } else {
        pendingQuantity = quantity
      }
      continue
    }
    const piece = interpretPiece(part)
    if (pendingQuantity !== null && !piece.explicit) {
      piece.quantity = pendingQuantity
      piece.explicit = true
      piece.alternatives = []
    }
    pendingQuantity = null
    pieces.push(piece)
  }
  return pieces.filter((piece) => /[\p{L}\p{N}]/u.test(piece.name))
}

/** Reads pasted text into at most `MAX_LIST_ENTRIES` entries; see the file comment for the rules. */
export function parseItemList(text: string): ParsedItemList {
  const entries: ParsedListEntry[] = []
  let ignored = 0

  for (const line of text.split(/\r\n|\r|\n/)) {
    for (const piece of parseLine(line)) {
      if (
        piece.name.length > MAX_ITEM_NAME_LENGTH ||
        entries.length >= MAX_LIST_ENTRIES
      ) {
        ignored++
      } else {
        entries.push({
          raw: piece.raw,
          name: piece.name,
          quantity: piece.quantity,
          alternatives: piece.alternatives,
        })
      }
    }
  }

  return { entries, ignored }
}
