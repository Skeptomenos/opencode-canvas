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

function isWordChar(char: string): boolean {
  return /[a-zA-Z0-9_]/.test(char)
}

function isWhitespace(char: string): boolean {
  return /\s/.test(char)
}

function isPunctuation(char: string): boolean {
  return !isWordChar(char) && !isWhitespace(char)
}

function getMaxCol(lineContent: string, mode: EditorState["mode"]): number {
  return mode === "insert" ? lineContent.length : Math.max(0, lineContent.length - 1)
}

function skipWhitespaceForward(lineContent: string, startCol: number): number {
  let col = startCol
  while (col < lineContent.length && isWhitespace(lineContent[col] ?? "")) {
    col = col + 1
  }
  return col
}

function skipWhitespaceBackward(lineContent: string, startCol: number): number {
  let col = startCol
  while (col > 0 && isWhitespace(lineContent[col] ?? "")) {
    col = col - 1
  }
  return col
}

function skipCurrentTokenForward(lineContent: string, startCol: number): number {
  let col = startCol
  const char = lineContent[col] ?? ""

  if (isWordChar(char)) {
    while (col < lineContent.length && isWordChar(lineContent[col] ?? "")) {
      col = col + 1
    }
  } else if (isWhitespace(char)) {
    while (col < lineContent.length && isWhitespace(lineContent[col] ?? "")) {
      col = col + 1
    }
  } else {
    while (col < lineContent.length && isPunctuation(lineContent[col] ?? "")) {
      col = col + 1
    }
  }
  return col
}

function findTokenStartBackward(lineContent: string, startCol: number): number {
  let col = startCol
  const char = lineContent[col] ?? ""

  if (isWordChar(char)) {
    while (col > 0 && isWordChar(lineContent[col - 1] ?? "")) {
      col = col - 1
    }
  } else if (isPunctuation(char)) {
    while (col > 0 && isPunctuation(lineContent[col - 1] ?? "")) {
      col = col - 1
    }
  }
  return col
}

export function moveToNextWord(state: EditorState): EditorState {
  let line = state.cursorLine
  let col = state.cursorCol
  const currentLine = state.lines[line] ?? ""

  const atOrPastLineEnd = col >= currentLine.length - 1
  const canMoveToNextLine = line < state.lines.length - 1

  if (atOrPastLineEnd) {
    if (canMoveToNextLine) {
      line = line + 1
      const newLine = state.lines[line] ?? ""
      col = skipWhitespaceForward(newLine, 0)
      return { ...state, cursorLine: line, cursorCol: Math.min(col, getMaxCol(newLine, state.mode)) }
    }
    return { ...state, cursorCol: getMaxCol(currentLine, state.mode) }
  }

  col = skipCurrentTokenForward(currentLine, col)
  col = skipWhitespaceForward(currentLine, col)

  if (col >= currentLine.length && canMoveToNextLine) {
    line = line + 1
    const newLine = state.lines[line] ?? ""
    col = skipWhitespaceForward(newLine, 0)
    return { ...state, cursorLine: line, cursorCol: Math.min(col, getMaxCol(newLine, state.mode)) }
  }

  const finalLine = state.lines[line] ?? ""
  return { ...state, cursorLine: line, cursorCol: Math.min(col, getMaxCol(finalLine, state.mode)) }
}

export function moveToPreviousWord(state: EditorState): EditorState {
  let line = state.cursorLine
  let col = state.cursorCol

  if (col === 0) {
    if (line > 0) {
      line = line - 1
      col = (state.lines[line] ?? "").length
    } else {
      return { ...state, cursorCol: 0 }
    }
  }

  const currentLine = state.lines[line] ?? ""

  if (col > 0) {
    col = col - 1
  }

  col = skipWhitespaceBackward(currentLine, col)

  const atLineStartWithWhitespace = col === 0 && isWhitespace(currentLine[col] ?? "") && line > 0
  if (atLineStartWithWhitespace) {
    line = line - 1
    const prevLine = state.lines[line] ?? ""
    col = skipWhitespaceBackward(prevLine, prevLine.length - 1)
    col = findTokenStartBackward(prevLine, col)
    return { ...state, cursorLine: line, cursorCol: col }
  }

  col = findTokenStartBackward(currentLine, col)
  return { ...state, cursorLine: line, cursorCol: col }
}
