import {
  isDialogOpen,
  isTypingTarget,
  shouldHandlePageShortcut,
} from "@/components/event-workspace/keyboard"

function press(
  key: string,
  init: KeyboardEventInit = {},
  target: Element = document.body
) {
  let event!: KeyboardEvent
  const listener = (e: KeyboardEvent) => (event = e)
  window.addEventListener("keydown", listener)
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    })
  )
  window.removeEventListener("keydown", listener)
  return event
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("isTypingTarget", () => {
  it("is true for form fields", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true)
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true)
    expect(isTypingTarget(document.createElement("select"))).toBe(true)
  })

  it("is false for other elements and null", () => {
    expect(isTypingTarget(document.createElement("button"))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe("isDialogOpen", () => {
  it("detects dialogs and alert dialogs", () => {
    expect(isDialogOpen()).toBe(false)
    document.body.innerHTML = '<div role="alertdialog"></div>'
    expect(isDialogOpen()).toBe(true)
  })
})

describe("shouldHandlePageShortcut", () => {
  it("allows a bare key on the page", () => {
    expect(shouldHandlePageShortcut(press("Escape"))).toBe(true)
  })

  it("ignores modified keys", () => {
    expect(shouldHandlePageShortcut(press("Escape", { ctrlKey: true }))).toBe(
      false
    )
  })

  it("ignores keys typed into a field", () => {
    const input = document.createElement("input")
    document.body.appendChild(input)
    expect(shouldHandlePageShortcut(press("Escape", {}, input))).toBe(false)
  })

  it("ignores keys inside an open menu or listbox", () => {
    document.body.innerHTML =
      '<div role="menu"><button id="item"></button></div>'
    const item = document.getElementById("item")!
    expect(shouldHandlePageShortcut(press("Escape", {}, item))).toBe(false)
  })

  it("ignores keys while a dialog is open", () => {
    document.body.innerHTML = '<div role="dialog"></div>'
    expect(shouldHandlePageShortcut(press("Escape"))).toBe(false)
  })

  it("ignores keys another handler already consumed", () => {
    const listener = (e: KeyboardEvent) => e.preventDefault()
    document.addEventListener("keydown", listener)
    const event = press("Escape")
    document.removeEventListener("keydown", listener)
    expect(shouldHandlePageShortcut(event)).toBe(false)
  })
})
