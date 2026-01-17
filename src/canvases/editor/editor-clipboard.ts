import type { EditorState } from "./editor-state"

export type ClipboardContent = {
  type: "line"
  lines: string[]
}

export interface ClipboardState {
  content: ClipboardContent | null
}

export function createClipboardState(): ClipboardState {
  return {
    content: null,
  }
}

export function yankLine(editorState: EditorState, clipboardState: ClipboardState): ClipboardState {
  const line = editorState.lines[editorState.cursorLine] ?? ""
  return {
    content: {
      type: "line",
      lines: [line],
    },
  }
}

export function deleteLine(
  editorState: EditorState,
  clipboardState: ClipboardState
): { editorState: EditorState; clipboardState: ClipboardState } {
  if (editorState.isReadOnly) {
    return { editorState, clipboardState }
  }

  const line = editorState.lines[editorState.cursorLine] ?? ""
  const newClipboardState: ClipboardState = {
    content: {
      type: "line",
      lines: [line],
    },
  }

  const newLines = [...editorState.lines]
  newLines.splice(editorState.cursorLine, 1)

  if (newLines.length === 0) {
    newLines.push("")
  }

  const newCursorLine = Math.min(editorState.cursorLine, newLines.length - 1)
  const newLine = newLines[newCursorLine] ?? ""
  const newCursorCol = Math.min(editorState.cursorCol, Math.max(0, newLine.length - 1))

  const newDirtyLines = new Set(editorState.dirtyLines)
  newDirtyLines.add(newCursorLine)

  const newEditorState: EditorState = {
    ...editorState,
    lines: newLines,
    cursorLine: newCursorLine,
    cursorCol: newCursorCol,
    isDirty: true,
    dirtyLines: newDirtyLines,
  }

  return { editorState: newEditorState, clipboardState: newClipboardState }
}

export function pasteAfter(editorState: EditorState, clipboardState: ClipboardState): EditorState {
  if (editorState.isReadOnly) {
    return editorState
  }

  if (!clipboardState.content) {
    return editorState
  }

  if (clipboardState.content.type !== "line") {
    return editorState
  }

  const newLines = [...editorState.lines]
  const insertIndex = editorState.cursorLine + 1
  newLines.splice(insertIndex, 0, ...clipboardState.content.lines)

  const newDirtyLines = new Set(editorState.dirtyLines)
  for (let i = 0; i < clipboardState.content.lines.length; i++) {
    newDirtyLines.add(insertIndex + i)
  }

  return {
    ...editorState,
    lines: newLines,
    cursorLine: insertIndex,
    cursorCol: 0,
    isDirty: true,
    dirtyLines: newDirtyLines,
  }
}

export function pasteBefore(editorState: EditorState, clipboardState: ClipboardState): EditorState {
  if (editorState.isReadOnly) {
    return editorState
  }

  if (!clipboardState.content) {
    return editorState
  }

  if (clipboardState.content.type !== "line") {
    return editorState
  }

  const newLines = [...editorState.lines]
  const insertIndex = editorState.cursorLine
  newLines.splice(insertIndex, 0, ...clipboardState.content.lines)

  const newDirtyLines = new Set(editorState.dirtyLines)
  for (let i = 0; i < clipboardState.content.lines.length; i++) {
    newDirtyLines.add(insertIndex + i)
  }

  return {
    ...editorState,
    lines: newLines,
    cursorLine: insertIndex,
    cursorCol: 0,
    isDirty: true,
    dirtyLines: newDirtyLines,
  }
}

export function shouldTriggerYankLine(
  key: { ctrl?: boolean; name?: string; sequence?: string },
  lastKey: string | null
): boolean {
  return key.name === "y" && lastKey === "y"
}

export function shouldTriggerDeleteLine(
  key: { ctrl?: boolean; name?: string; sequence?: string },
  lastKey: string | null
): boolean {
  return key.name === "d" && lastKey === "d"
}

export function shouldTriggerPasteAfter(key: { ctrl?: boolean; name?: string; sequence?: string }): boolean {
  return key.name === "p" && !key.ctrl
}

export function shouldTriggerPasteBefore(key: { ctrl?: boolean; name?: string; sequence?: string }): boolean {
  return key.name === "p" && key.ctrl !== true && key.sequence === "P"
}
