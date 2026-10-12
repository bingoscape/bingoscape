import { act, renderHook } from "@testing-library/react"
import { createRememberedChoice } from "@/hooks/use-remembered-choice"

const KEY = "test:remembered-choice"
type Size = "small" | "large" | "huge"
const SIZES: readonly Size[] = ["small", "large", "huge"]

function setup() {
  const choice = createRememberedChoice<Size>(KEY, SIZES, "small")
  return { choice, ...renderHook(() => choice.useValue()) }
}

describe("createRememberedChoice", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("starts on the fallback", () => {
    const { result } = setup()

    expect(result.current[0]).toBe("small")
  })

  it("remembers a choice in localStorage", () => {
    const { result } = setup()

    act(() => result.current[1]("large"))

    expect(result.current[0]).toBe("large")
    expect(window.localStorage.getItem(KEY)).toBe("large")
  })

  it("is restored by a hook mounted later", () => {
    const { result } = setup()
    act(() => result.current[1]("huge"))

    const { result: later } = setup()

    expect(later.current[0]).toBe("huge")
  })

  it("updates every mounted user of the choice", () => {
    const choice = createRememberedChoice<Size>(KEY, SIZES, "small")
    const first = renderHook(() => choice.useValue())
    const second = renderHook(() => choice.useValue())

    act(() => first.result.current[1]("large"))

    expect(second.result.current[0]).toBe("large")
  })

  it("ignores a stored value that is not one of the choices", () => {
    window.localStorage.setItem(KEY, "gigantic")

    const { result } = setup()

    expect(result.current[0]).toBe("small")
  })

  it("forgets the choice on reset", () => {
    const { result, choice } = setup()
    act(() => result.current[1]("large"))

    act(() => choice.reset())

    expect(result.current[0]).toBe("small")
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it("keeps the choice in memory when storage is blocked", () => {
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked")
      })
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked")
      })
    const { result } = setup()

    act(() => result.current[1]("huge"))

    expect(result.current[0]).toBe("huge")
    getItem.mockRestore()
    setItem.mockRestore()
  })
})
