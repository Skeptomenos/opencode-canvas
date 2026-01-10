import type { EditorState } from "./editor-state"

const MAX_UNDO_STACK_SIZE = 100

export interface UndoOperation {
  type: "insert_char" | "delete_char" | "insert_line" | "delete_line" | "join_lines" | "split_line"
  beforeLines: string[]
  afterLines: string[]
  beforeCursorLine: number
  beforeCursorCol: number
  afterCursorLine: number
  afterCursorCol: number
}

export interface UndoState {
  undoStack: UndoOperation[]
  redoStack: UndoOperation[]
}

export function createUndoState(): UndoState {
  return {
    undoStack: [],
    redoStack: [],
  }
}

export function pushUndoOperation(undoState: UndoState, operation: UndoOperation): UndoState {
  const undoStack = [...undoState.undoStack, operation]

  if (undoStack.length > MAX_UNDO_STACK_SIZE) {
    undoStack.shift()
  }

  return {
    undoStack,
    redoStack: [],
  }
}

export function canUndo(undoState: UndoState): boolean {
  return undoState.undoStack.length > 0
}

export function canRedo(undoState: UndoState): boolean {
  return undoState.redoStack.length > 0
}

export function performUndo(
  editorState: EditorState,
  undoState: UndoState
): { editorState: EditorState; undoState: UndoState } {
  if (!canUndo(undoState)) {
    return { editorState, undoState }
  }

  const undoStack = [...undoState.undoStack]
  const operation = undoStack.pop()

  if (!operation) {
    return { editorState, undoState }
  }

  const inverseOperation: UndoOperation = {
    type: operation.type,
    beforeLines: operation.afterLines,
    afterLines: operation.beforeLines,
    beforeCursorLine: operation.afterCursorLine,
    beforeCursorCol: operation.afterCursorCol,
    afterCursorLine: operation.beforeCursorLine,
    afterCursorCol: operation.beforeCursorCol,
  }

  const newEditorState: EditorState = {
    ...editorState,
    lines: [...operation.beforeLines],
    cursorLine: operation.beforeCursorLine,
    cursorCol: operation.beforeCursorCol,
    isDirty: true,
  }

  const redoStack = [...undoState.redoStack, inverseOperation]

  return {
    editorState: newEditorState,
    undoState: {
      undoStack,
      redoStack,
    },
  }
}

export function performRedo(
  editorState: EditorState,
  undoState: UndoState
): { editorState: EditorState; undoState: UndoState } {
  if (!canRedo(undoState)) {
    return { editorState, undoState }
  }

  const redoStack = [...undoState.redoStack]
  const operation = redoStack.pop()

  if (!operation) {
    return { editorState, undoState }
  }

  const inverseOperation: UndoOperation = {
    type: operation.type,
    beforeLines: operation.afterLines,
    afterLines: operation.beforeLines,
    beforeCursorLine: operation.afterCursorLine,
    beforeCursorCol: operation.afterCursorCol,
    afterCursorLine: operation.beforeCursorLine,
    afterCursorCol: operation.beforeCursorCol,
  }

  const newEditorState: EditorState = {
    ...editorState,
    lines: [...operation.afterLines],
    cursorLine: operation.afterCursorLine,
    cursorCol: operation.afterCursorCol,
    isDirty: true,
  }

  const undoStack = [...undoState.undoStack, inverseOperation]

  return {
    editorState: newEditorState,
    undoState: {
      undoStack,
      redoStack,
    },
  }
}

export function clearUndoStack(undoState: UndoState): UndoState {
  return {
    undoStack: [],
    redoStack: [],
  }
}

export function createUndoOperation(
  type: UndoOperation["type"],
  beforeState: EditorState,
  afterState: EditorState
): UndoOperation {
  return {
    type,
    beforeLines: [...beforeState.lines],
    afterLines: [...afterState.lines],
    beforeCursorLine: beforeState.cursorLine,
    beforeCursorCol: beforeState.cursorCol,
    afterCursorLine: afterState.cursorLine,
    afterCursorCol: afterState.cursorCol,
  }
}

export function shouldTriggerUndo(key: { ctrl?: boolean; name?: string; sequence?: string }): boolean {
  return key.name === "u" && !key.ctrl
}

export function shouldTriggerRedo(key: { ctrl?: boolean; name?: string; sequence?: string }): boolean {
  return key.ctrl === true && key.name === "r"
}
