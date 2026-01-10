import type { EditorState } from "./editor-state"
import { getCurrentLine } from "./editor-state"

export function enterInsertMode(state: EditorState): EditorState {
  if (state.isReadOnly) {
    return state
  }
  return {
    ...state,
    mode: "insert",
  }
}

export function enterInsertModeAfter(state: EditorState): EditorState {
  if (state.isReadOnly) {
    return state
  }
  const line = getCurrentLine(state)
  return {
    ...state,
    mode: "insert",
    cursorCol: Math.min(state.cursorCol + 1, line.length),
  }
}

export function exitInsertMode(state: EditorState): EditorState {
  const line = getCurrentLine(state)
  const maxCol = Math.max(0, line.length - 1)
  return {
    ...state,
    mode: "normal",
    cursorCol: Math.min(state.cursorCol, maxCol),
  }
}

export function insertChar(state: EditorState, char: string): EditorState {
  if (state.isReadOnly || state.mode !== "insert") {
    return state
  }

  const line = getCurrentLine(state)
  const before = line.slice(0, state.cursorCol)
  const after = line.slice(state.cursorCol)
  const newLine = before + char + after

  const newLines = [...state.lines]
  newLines[state.cursorLine] = newLine

  const newDirtyLines = new Set(state.dirtyLines)
  newDirtyLines.add(state.cursorLine)

  return {
    ...state,
    lines: newLines,
    cursorCol: state.cursorCol + char.length,
    isDirty: true,
    dirtyLines: newDirtyLines,
  }
}

export function deleteCharBefore(state: EditorState): EditorState {
  if (state.isReadOnly || state.mode !== "insert") {
    return state
  }

  const line = getCurrentLine(state)

  if (state.cursorCol === 0) {
    if (state.cursorLine === 0) {
      return state
    }

    const prevLine = state.lines[state.cursorLine - 1] ?? ""
    const newCursorCol = prevLine.length
    const joinedLine = prevLine + line

    const newLines = [...state.lines]
    newLines.splice(state.cursorLine - 1, 2, joinedLine)

    const newDirtyLines = new Set(state.dirtyLines)
    newDirtyLines.add(state.cursorLine - 1)

    return {
      ...state,
      lines: newLines,
      cursorLine: state.cursorLine - 1,
      cursorCol: newCursorCol,
      isDirty: true,
      dirtyLines: newDirtyLines,
    }
  }

  const before = line.slice(0, state.cursorCol - 1)
  const after = line.slice(state.cursorCol)
  const newLine = before + after

  const newLines = [...state.lines]
  newLines[state.cursorLine] = newLine

  const newDirtyLines = new Set(state.dirtyLines)
  newDirtyLines.add(state.cursorLine)

  return {
    ...state,
    lines: newLines,
    cursorCol: state.cursorCol - 1,
    isDirty: true,
    dirtyLines: newDirtyLines,
  }
}

export function insertNewLine(state: EditorState): EditorState {
  if (state.isReadOnly || state.mode !== "insert") {
    return state
  }

  const line = getCurrentLine(state)
  const before = line.slice(0, state.cursorCol)
  const after = line.slice(state.cursorCol)

  const newLines = [...state.lines]
  newLines.splice(state.cursorLine, 1, before, after)

  const newDirtyLines = new Set(state.dirtyLines)
  newDirtyLines.add(state.cursorLine)
  newDirtyLines.add(state.cursorLine + 1)

  return {
    ...state,
    lines: newLines,
    cursorLine: state.cursorLine + 1,
    cursorCol: 0,
    isDirty: true,
    dirtyLines: newDirtyLines,
  }
}

export function getModeIndicator(state: EditorState): string {
  return state.mode === "insert" ? "-- INSERT --" : "-- NORMAL --"
}

export function getPrintableChar(sequence: string): string | null {
  if (sequence.length === 1 && sequence.charCodeAt(0) >= 32 && sequence.charCodeAt(0) < 127) {
    return sequence
  }
  return null
}

export function openLineBelow(state: EditorState): EditorState {
  if (state.isReadOnly) {
    return state
  }

  const newLines = [...state.lines]
  newLines.splice(state.cursorLine + 1, 0, "")

  const newDirtyLines = new Set(state.dirtyLines)
  newDirtyLines.add(state.cursorLine + 1)

  return {
    ...state,
    lines: newLines,
    cursorLine: state.cursorLine + 1,
    cursorCol: 0,
    mode: "insert",
    isDirty: true,
    dirtyLines: newDirtyLines,
  }
}

export function openLineAbove(state: EditorState): EditorState {
  if (state.isReadOnly) {
    return state
  }

  const newLines = [...state.lines]
  newLines.splice(state.cursorLine, 0, "")

  const newDirtyLines = new Set(state.dirtyLines)
  newDirtyLines.add(state.cursorLine)

  return {
    ...state,
    lines: newLines,
    cursorCol: 0,
    mode: "insert",
    isDirty: true,
    dirtyLines: newDirtyLines,
  }
}

export function enterInsertModeAtEnd(state: EditorState): EditorState {
  if (state.isReadOnly) {
    return state
  }

  const line = getCurrentLine(state)
  return {
    ...state,
    mode: "insert",
    cursorCol: line.length,
  }
}

export function enterInsertModeAtStart(state: EditorState): EditorState {
  if (state.isReadOnly) {
    return state
  }

  return {
    ...state,
    mode: "insert",
    cursorCol: 0,
  }
}

export function deleteCharUnderCursor(state: EditorState): EditorState {
  if (state.isReadOnly || state.mode !== "normal") {
    return state
  }

  const line = getCurrentLine(state)

  if (line.length === 0) {
    return state
  }

  if (state.cursorCol >= line.length) {
    return state
  }

  const before = line.slice(0, state.cursorCol)
  const after = line.slice(state.cursorCol + 1)
  const newLine = before + after

  const newLines = [...state.lines]
  newLines[state.cursorLine] = newLine

  const newCursorCol = newLine.length === 0 ? 0 : Math.min(state.cursorCol, newLine.length - 1)

  const newDirtyLines = new Set(state.dirtyLines)
  newDirtyLines.add(state.cursorLine)

  return {
    ...state,
    lines: newLines,
    cursorCol: newCursorCol,
    isDirty: true,
    dirtyLines: newDirtyLines,
  }
}

export function shouldTriggerDeleteCharUnderCursor(
  key: { ctrl?: boolean; name?: string; sequence?: string },
  mode: "normal" | "insert"
): boolean {
  return mode === "normal" && key.name === "x" && !key.ctrl
}
