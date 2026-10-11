import { act, fireEvent, renderHook } from "@testing-library/react"
import type { MouseEvent } from "react"
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
})
