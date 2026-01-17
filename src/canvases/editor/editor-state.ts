export type EditorMode = "normal" | "insert"

export type ReadOnlyReason = "node_modules" | "git_directory" | "binary_file" | "file_too_large" | null

export interface EditorState {
  mode: EditorMode
  lines: string[]
  cursorLine: number
  cursorCol: number
  isDirty: boolean
  dirtyLines: Set<number>
  filePath: string | null
  isReadOnly: boolean
  isReadOnlyReason: ReadOnlyReason
}

export interface CreateEditorStateOptions {
  content?: string
  filePath?: string | null
  isReadOnly?: boolean
  isReadOnlyReason?: ReadOnlyReason
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
    dirtyLines: new Set<number>(),
    filePath: options.filePath ?? null,
    isReadOnly: options.isReadOnly ?? false,
    isReadOnlyReason: options.isReadOnlyReason ?? null,
  }
}

export function getEditorContent(state: EditorState): string {
  return state.lines.join("\n")
}

export function getCurrentLine(state: EditorState): string {
  return state.lines[state.cursorLine] ?? ""
}
