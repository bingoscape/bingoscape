/** A scriptable stand-in for the browser EventSource (jsdom has none). */
export class FakeEventSource {
  static instances: FakeEventSource[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  private listeners = new Map<string, ((message: MessageEvent) => void)[]>()

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (message: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  close() {
    this.closed = true
  }

  open() {
    this.onopen?.()
  }

  fail() {
    this.onerror?.()
  }

  emit(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(data) } as MessageEvent)
    }
  }

  static get last() {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1]!
  }

  static install() {
    FakeEventSource.instances = []
    ;(global as unknown as { EventSource: unknown }).EventSource =
      FakeEventSource
  }

  static uninstall() {
    delete (global as unknown as { EventSource?: unknown }).EventSource
  }
}
