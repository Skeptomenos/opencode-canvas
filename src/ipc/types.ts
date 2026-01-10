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

export function getSocketPath(id: string): string {
  return `/tmp/canvas-${id}.sock`
}
