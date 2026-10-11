import { createRef } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { SplitHandle } from "@/components/event-workspace/split-handle"

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function box(width: number): HTMLElement {
  const el = document.createElement("div")
  el.getBoundingClientRect = () => ({ width, right: width }) as DOMRect
  return el
}

function setup() {
  const container = createRef<HTMLElement>()
  const side = createRef<HTMLElement>()
  ;(container as { current: HTMLElement }).current = box(1000)
  ;(side as { current: HTMLElement }).current = box(400)
  const handlers = {
    onResize: jest.fn(),
    onCommit: jest.fn(),
    onReset: jest.fn(),
    onToggleCollapse: jest.fn(),
  }
  render(
    <SplitHandle
      containerRef={container}
      sideRef={side}
      controlsId="side"
      {...handlers}
    />
  )
  return { handle: screen.getByRole("separator"), ...handlers }
}

describe("SplitHandle", () => {
  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jsdom has no ResizeObserver
    ;(global as any).ResizeObserver = ResizeObserverStub
  })

  it("exposes the splitter ARIA values as a share of the workspace", () => {
    const { handle } = setup()
    expect(handle).toHaveAttribute("aria-orientation", "vertical")
    expect(handle).toHaveAttribute("aria-valuenow", "40")
    expect(handle).toHaveAttribute("aria-valuemin", "32")
    expect(handle).toHaveAttribute("aria-valuemax", "60")
  })

  it("grows the side panel with ArrowLeft and shrinks it with ArrowRight", () => {
    const { handle, onResize, onCommit } = setup()
    fireEvent.keyDown(handle, { key: "ArrowLeft" })
    expect(onResize).toHaveBeenLastCalledWith(416)
    expect(onCommit).toHaveBeenLastCalledWith(416)
    fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true })
    expect(onResize).toHaveBeenLastCalledWith(336)
  })

  it("jumps to the limits with Home and End", () => {
    const { handle, onCommit } = setup()
    fireEvent.keyDown(handle, { key: "Home" })
    expect(onCommit).toHaveBeenLastCalledWith(320)
    fireEvent.keyDown(handle, { key: "End" })
    expect(onCommit).toHaveBeenLastCalledWith(600)
  })

  it("collapses on Enter and resets on double-click", () => {
    const { handle, onToggleCollapse, onReset } = setup()
    fireEvent.keyDown(handle, { key: "Enter" })
    expect(onToggleCollapse).toHaveBeenCalledTimes(1)
    fireEvent.doubleClick(handle)
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
