export type EditorMode = "normal" | "insert"

export interface EditorState {
  mode: EditorMode
  lines: string[]
  cursorLine: number
  cursorCol: number
  isDirty: boolean
  filePath: string | null
  isReadOnly: boolean
}

export interface CreateEditorStateOptions {
  content?: string
  filePath?: string | null
  isReadOnly?: boolean
}

export function createEditorState(options: CreateEditorStateOptions = {}): EditorState {
  const content = options.content ?? ""
  const lines = content.split("\n")

  if (lines.length === 0) {
    lines.push("")
  }

  return {
    mode: "normal",
    lines,
    cursorLine: 0,
    cursorCol: 0,
    isDirty: false,
    filePath: options.filePath ?? null,
    isReadOnly: options.isReadOnly ?? false,
  }
}

export function getEditorContent(state: EditorState): string {
  return state.lines.join("\n")
}

export function getCurrentLine(state: EditorState): string {
  return state.lines[state.cursorLine] ?? ""
}

export function clampCursorCol(state: EditorState): number {
  const line = getCurrentLine(state)
  const maxCol = state.mode === "insert" ? line.length : Math.max(0, line.length - 1)
  return Math.max(0, Math.min(state.cursorCol, maxCol))
}
