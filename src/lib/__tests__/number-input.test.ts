import {
  formatNumber,
  formatNumberPreview,
  parseNumberInput,
  parseTargetInput,
  validateNumberInput,
} from "@/lib/number-input"

const num = (value: number) => ({ kind: "number", value })

describe("parseNumberInput", () => {
  it.each([
    ["500000", 500000],
    ["1", 1],
    ["  42  ", 42],
    ["0", 0],
  ])("reads plain digits %p", (raw, value) => {
    expect(parseNumberInput(raw)).toEqual(num(value))
  })

  it.each([
    ["500k", 500_000],
    ["500K", 500_000],
    ["1m", 1_000_000],
    ["1M", 1_000_000],
    ["2.5m", 2_500_000],
    ["0.5m", 500_000],
    [".5m", 500_000],
    ["1.5k", 1_500],
    ["1b", 1_000_000_000],
    ["2.55k", 2_550],
    ["1.1m", 1_100_000],
  ])("expands the shorthand %p", (raw, value) => {
    expect(parseNumberInput(raw)).toEqual(num(value))
  })

  it.each([
    ["13,034,431", 13_034_431],
    ["1,000", 1_000],
    ["13 034 431", 13_034_431],
    ["13_034_431", 13_034_431],
    ["1,000k", 1_000_000],
  ])("accepts thousands separators in %p", (raw, value) => {
    expect(parseNumberInput(raw)).toEqual(num(value))
  })

  it("treats blank input as empty", () => {
    expect(parseNumberInput("")).toEqual({ kind: "empty" })
    expect(parseNumberInput("   ")).toEqual({ kind: "empty" })
  })

  it.each([
    "abc",
    "k",
    "-",
    ".",
    "5x",
    "1e3",
    "1.2.3",
    "5kk",
    "k5",
    "12,34",
    "2,5m",
    ",500",
    "1,0000",
    "Infinity",
    "0x10",
  ])("rejects %p", (raw) => {
    expect(parseNumberInput(raw)).toEqual({ kind: "invalid" })
  })

  it("keeps fractions and signs so the validator can explain them", () => {
    expect(parseNumberInput("1.5")).toEqual(num(1.5))
    expect(parseNumberInput("-5")).toEqual(num(-5))
    expect(parseNumberInput("0.0000001")).toEqual(num(0))
  })
})

describe("validateNumberInput", () => {
  it("accepts whole numbers in range", () => {
    expect(validateNumberInput("1")).toBeNull()
    expect(validateNumberInput("500k")).toBeNull()
    expect(validateNumberInput("13,034,431")).toBeNull()
    expect(validateNumberInput("2147483647")).toBeNull()
  })

  it("asks for a number when empty", () => {
    expect(validateNumberInput("")).toBe("Enter a number")
  })

  it("explains unreadable input", () => {
    expect(validateNumberInput("lots")).toMatch(/whole number/)
  })

  it("rejects zero and negative values", () => {
    expect(validateNumberInput("0")).toMatch(/greater than 0/)
    expect(validateNumberInput("-3")).toMatch(/greater than 0/)
  })

  it("rejects fractions", () => {
    expect(validateNumberInput("1.5")).toMatch(/whole number/)
    expect(validateNumberInput("0.0005m")).toBeNull() // 500
    expect(validateNumberInput("1.0001k")).toMatch(/whole number/)
  })

  it("rejects values above the integer column limit", () => {
    expect(validateNumberInput("2147483648")).toMatch(
      /cannot exceed 2,147,483,647/
    )
    expect(validateNumberInput("3b")).toMatch(/cannot exceed/)
    expect(validateNumberInput("99999999999999999999")).toMatch(/cannot exceed/)
  })

  it("uses a custom validator when given", () => {
    const atLeastTen = (value: number) => (value < 10 ? "Too small" : null)
    expect(validateNumberInput("5", atLeastTen)).toBe("Too small")
    expect(validateNumberInput("1k", atLeastTen)).toBeNull()
  })
})

describe("parseTargetInput", () => {
  it("returns the value only when it is a valid target", () => {
    expect(parseTargetInput("2.5m")).toBe(2_500_000)
    expect(parseTargetInput("")).toBeNull()
    expect(parseTargetInput("0")).toBeNull()
    expect(parseTargetInput("1.5")).toBeNull()
    expect(parseTargetInput("nope")).toBeNull()
  })
})

describe("formatNumber", () => {
  it("groups thousands with commas regardless of locale", () => {
    expect(formatNumber(13034431)).toBe("13,034,431")
    expect(formatNumber(7)).toBe("7")
  })
})

describe("formatNumberPreview", () => {
  it("shows what the text means, with the unit", () => {
    expect(formatNumberPreview("500k", "XP")).toBe("= 500,000 XP")
    expect(formatNumberPreview("13034431", "XP")).toBe("= 13,034,431 XP")
  })

  it("works without a unit", () => {
    expect(formatNumberPreview("2m")).toBe("= 2,000,000")
    expect(formatNumberPreview("2m", "")).toBe("= 2,000,000")
  })

  it("uses the singular unit for one", () => {
    expect(formatNumberPreview("1", "kills", "kill")).toBe("= 1 kill")
    expect(formatNumberPreview("2", "kills", "kill")).toBe("= 2 kills")
    expect(formatNumberPreview("1", "kills")).toBe("= 1 kills")
  })

  it("shows nothing for an invalid target", () => {
    expect(formatNumberPreview("", "XP")).toBeNull()
    expect(formatNumberPreview("abc", "XP")).toBeNull()
    expect(formatNumberPreview("0", "XP")).toBeNull()
  })
})
