import type { EditorState } from "./editor-state"
import { getCurrentLine } from "./editor-state"

export function moveLeft(state: EditorState): EditorState {
  return {
    ...state,
    cursorCol: Math.max(0, state.cursorCol - 1),
  }
}

export function moveRight(state: EditorState): EditorState {
  const line = getCurrentLine(state)
  const maxCol = state.mode === "insert" ? line.length : Math.max(0, line.length - 1)
  return {
    ...state,
    cursorCol: Math.min(state.cursorCol + 1, maxCol),
  }
}

export function moveDown(state: EditorState): EditorState {
  const newLine = Math.min(state.cursorLine + 1, state.lines.length - 1)
  const newLineContent = state.lines[newLine] ?? ""
  const maxCol = state.mode === "insert" ? newLineContent.length : Math.max(0, newLineContent.length - 1)
  return {
    ...state,
    cursorLine: newLine,
    cursorCol: Math.min(state.cursorCol, maxCol),
  }
}

export function moveUp(state: EditorState): EditorState {
  const newLine = Math.max(0, state.cursorLine - 1)
  const newLineContent = state.lines[newLine] ?? ""
  const maxCol = state.mode === "insert" ? newLineContent.length : Math.max(0, newLineContent.length - 1)
  return {
    ...state,
    cursorLine: newLine,
    cursorCol: Math.min(state.cursorCol, maxCol),
  }
}

export function moveToLineStart(state: EditorState): EditorState {
  return {
    ...state,
    cursorCol: 0,
  }
}

export function moveToLineEnd(state: EditorState): EditorState {
  const line = getCurrentLine(state)
  const maxCol = state.mode === "insert" ? line.length : Math.max(0, line.length - 1)
  return {
    ...state,
    cursorCol: maxCol,
  }
}

export function moveToFirstLine(state: EditorState): EditorState {
  return {
    ...state,
    cursorLine: 0,
    cursorCol: 0,
  }
}

export function moveToLastLine(state: EditorState): EditorState {
  return {
    ...state,
    cursorLine: state.lines.length - 1,
    cursorCol: 0,
  }
}
