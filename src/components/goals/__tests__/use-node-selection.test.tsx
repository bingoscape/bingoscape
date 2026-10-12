import { act, fireEvent, renderHook } from "@testing-library/react"
import type { KeyboardEvent, MouseEvent } from "react"
import { useNodeSelection } from "@/components/goals/use-node-selection"

const plainClick = {} as MouseEvent
const ctrlClick = { ctrlKey: true } as MouseEvent
const metaClick = { metaKey: true } as MouseEvent

describe("useNodeSelection", () => {
  it("toggles nodes with Ctrl or Cmd click", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => result.current.handleNodeClick("a", ctrlClick))
    act(() => result.current.handleNodeClick("b", metaClick))
    expect([...result.current.selectedNodes]).toEqual(["a", "b"])
    expect(result.current.isNodeSelected("a")).toBe(true)

    act(() => result.current.handleNodeClick("a", ctrlClick))
    expect([...result.current.selectedNodes]).toEqual(["b"])
  })

  it("clears the selection on a plain click of an unselected node only", () => {
    const { result } = renderHook(() => useNodeSelection())
    act(() => result.current.handleNodeClick("a", ctrlClick))

    act(() => result.current.handleNodeClick("a", plainClick))
    expect([...result.current.selectedNodes]).toEqual(["a"])

    act(() => result.current.handleNodeClick("other", plainClick))
    expect(result.current.selectedNodes.size).toBe(0)
  })

  it("clears the selection on Escape", () => {
    const { result } = renderHook(() => useNodeSelection())
    act(() => result.current.handleNodeClick("a", ctrlClick))

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" })
    })
    expect(result.current.selectedNodes.size).toBe(0)
  })

  it("toggles a node with Enter or Space, like Ctrl+Click", () => {
    const { result } = renderHook(() => useNodeSelection())
    const enter = { key: "Enter" } as KeyboardEvent<Element>
    const space = { key: " " } as KeyboardEvent<Element>

    act(() => result.current.handleNodeClick("a", enter))
    act(() => result.current.handleNodeClick("b", space))
    expect([...result.current.selectedNodes]).toEqual(["a", "b"])

    act(() => result.current.handleNodeClick("a", space))
    expect([...result.current.selectedNodes]).toEqual(["b"])
  })

  it("ignores other keys", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => result.current.handleNodeClick("a", { key: "a" } as KeyboardEvent<Element>))
    expect(result.current.selectedNodes.size).toBe(0)
  })

  describe("Escape", () => {
    const select = () => {
      const hook = renderHook(() => useNodeSelection())
      act(() => hook.result.current.handleNodeClick("a", ctrlClick))
      return hook.result
    }

    afterEach(() => {
      document.body.innerHTML = ""
    })

    it("does not clear the selection when the key press is already handled (a Sheet or Dialog closing)", () => {
      const result = select()

      act(() => {
        // Radix calls preventDefault in its capture-phase listener when it dismisses a layer.
        document.addEventListener("keydown", (e) => e.preventDefault(), {
          capture: true,
          once: true,
        })
        // Dispatched on an element (not the document itself), so the capture
        // listener above is guaranteed to run before the hook's listener.
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
          })
        )
      })

      expect(result.current.selectedNodes.size).toBe(1)
    })

    it("does not clear the selection for Escape pressed inside a dialog", () => {
      const result = select()
      const dialog = document.createElement("div")
      dialog.setAttribute("role", "dialog")
      const field = document.createElement("input")
      dialog.append(field)
      document.body.append(dialog)

      act(() => {
        fireEvent.keyDown(field, { key: "Escape" })
      })

      expect(result.current.selectedNodes.size).toBe(1)
    })

    it("does not clear the selection for Escape pressed inside an alert dialog", () => {
      const result = select()
      const dialog = document.createElement("div")
      dialog.setAttribute("role", "alertdialog")
      const button = document.createElement("button")
      dialog.append(button)
      document.body.append(dialog)

      act(() => {
        fireEvent.keyDown(button, { key: "Escape" })
      })

      expect(result.current.selectedNodes.size).toBe(1)
    })

    it("still clears the selection for Escape on the page", () => {
      const result = select()
      const button = document.createElement("button")
      document.body.append(button)

      act(() => {
        fireEvent.keyDown(button, { key: "Escape" })
      })

      expect(result.current.selectedNodes.size).toBe(0)
    })
  })
})
