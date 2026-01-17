// Messages from Controller to Canvas
export type ControllerMessage =
  | { type: "close" }
  | { type: "update"; config: unknown }
  | { type: "ping" }
  | { type: "getSelection" }
  | { type: "getContent" }

// Messages from Canvas to Controller
export type CanvasMessage =
  | { type: "ready"; scenario: string }
  | { type: "selected"; data: unknown }
  | { type: "cancelled"; reason?: string }
  | { type: "error"; message: string }
  | { type: "pong" }
  | { type: "selection"; data: SelectionData | null }
  | { type: "content"; data: ContentData }

export interface SelectionData {
  selectedText: string
  startOffset: number
  endOffset: number
}

export interface ContentData {
  content: string
  cursorPosition: number
}

const SOCKET_DIR = process.env.CANVAS_SOCKET_DIR || process.env.XDG_RUNTIME_DIR || "/tmp"

export function getSocketPath(id: string): string {
  return `${SOCKET_DIR}/canvas-${id}.sock`
}

const CANVAS_MESSAGE_TYPES = ["ready", "selected", "cancelled", "error", "pong", "selection", "content"] as const

export function isCanvasMessage(msg: unknown): msg is CanvasMessage {
  if (typeof msg !== "object" || msg === null) return false
  const m = msg as Record<string, unknown>
  return typeof m.type === "string" && CANVAS_MESSAGE_TYPES.includes(m.type as (typeof CANVAS_MESSAGE_TYPES)[number])
}

const CONTROLLER_MESSAGE_TYPES = ["close", "update", "ping", "getSelection", "getContent"] as const

export function isControllerMessage(msg: unknown): msg is ControllerMessage {
  if (typeof msg !== "object" || msg === null) return false
  const m = msg as Record<string, unknown>
  return (
    typeof m.type === "string" && CONTROLLER_MESSAGE_TYPES.includes(m.type as (typeof CONTROLLER_MESSAGE_TYPES)[number])
  )
}
