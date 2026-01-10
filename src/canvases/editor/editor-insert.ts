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

  return {
    ...state,
    lines: newLines,
    cursorCol: state.cursorCol + char.length,
    isDirty: true,
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

    return {
      ...state,
      lines: newLines,
      cursorLine: state.cursorLine - 1,
      cursorCol: newCursorCol,
      isDirty: true,
    }
  }

  const before = line.slice(0, state.cursorCol - 1)
  const after = line.slice(state.cursorCol)
  const newLine = before + after

  const newLines = [...state.lines]
  newLines[state.cursorLine] = newLine

  return {
    ...state,
    lines: newLines,
    cursorCol: state.cursorCol - 1,
    isDirty: true,
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

  return {
    ...state,
    lines: newLines,
    cursorLine: state.cursorLine + 1,
    cursorCol: 0,
    isDirty: true,
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

  return {
    ...state,
    lines: newLines,
    cursorLine: state.cursorLine + 1,
    cursorCol: 0,
    mode: "insert",
    isDirty: true,
  }
}

export function openLineAbove(state: EditorState): EditorState {
  if (state.isReadOnly) {
    return state
  }

  const newLines = [...state.lines]
  newLines.splice(state.cursorLine, 0, "")

  return {
    ...state,
    lines: newLines,
    cursorCol: 0,
    mode: "insert",
    isDirty: true,
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
