import { createSignal, createMemo, Index, For, Show, onMount, onCleanup, createEffect } from "solid-js"
import type { ScrollBoxRenderable, MouseEvent } from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { createEditorState, getEditorContent, getCurrentLine, type EditorState } from "./editor-state"
import { checkReadOnly, getReadOnlyReasonMessage, getReadOnlyStatusIndicator } from "./editor-readonly"
import {
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  moveToLineStart,
  moveToLineEnd,
  moveToFirstLine,
  moveToLastLine,
  moveToNextWord,
  moveToPreviousWord,
} from "./editor-navigation"
import {
  enterInsertMode,
  enterInsertModeAfter,
  exitInsertMode,
  insertChar,
  deleteCharBefore,
  insertNewLine,
  getModeIndicator,
  getPrintableChar,
  openLineBelow,
  openLineAbove,
  enterInsertModeAtEnd,
  enterInsertModeAtStart,
  deleteCharUnderCursor,
  shouldTriggerDeleteCharUnderCursor,
} from "./editor-insert"
import {
  createSaveState,
  startSaveConfirmation,
  cancelSaveConfirmation,
  setSavedMessage,
  clearMessage,
  performSave,
  markAsSaved,
  shouldTriggerSave,
  type SaveState,
} from "./editor-save"
import {
  createCommandState,
  startCommandMode,
  appendToCommand,
  deleteFromCommand,
  cancelCommandMode,
  executeCommand,
  parseCommand,
  shouldStartCommandMode,
  getCommandPrompt,
  type CommandState,
} from "./editor-command"
import {
  createQuitState,
  startQuitConfirmation,
  cancelQuitConfirmation,
  confirmQuitWithSave,
  confirmQuitWithoutSave,
  forceQuit,
  canQuitImmediately,
  getQuitPrompt,
  handleSaveAndQuit,
  getTitleWithDirtyIndicator,
  type QuitState,
} from "./editor-quit"
import {
  createUndoState,
  pushUndoOperation,
  performUndo,
  performRedo,
  clearUndoStack,
  createUndoOperation,
  shouldTriggerUndo,
  shouldTriggerRedo,
  type UndoState,
} from "./editor-undo"
import {
  createClipboardState,
  yankLine,
  deleteLine,
  pasteAfter,
  pasteBefore,
  shouldTriggerYankLine,
  shouldTriggerDeleteLine,
  shouldTriggerPasteAfter,
  shouldTriggerPasteBefore,
  type ClipboardState,
} from "./editor-clipboard"

export interface EditorProps {
  content: string
  filePath: string | null
  title: string
  onExit: () => void
  onSave?: (content: string) => Promise<void>
  embedded?: boolean
}

export function Editor(props: EditorProps) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()

  const [editorState, setEditorState] = createSignal<EditorState>(
    createEditorState({ content: props.content, filePath: props.filePath })
  )
  const [saveState, setSaveState] = createSignal<SaveState>(createSaveState())
  const [commandState, setCommandState] = createSignal<CommandState>(createCommandState())
  const [quitState, setQuitState] = createSignal<QuitState>(createQuitState())
  const [undoState, setUndoState] = createSignal<UndoState>(createUndoState())
  const [clipboardState, setClipboardState] = createSignal<ClipboardState>(createClipboardState())
  const [lastKey, setLastKey] = createSignal<string | null>(null)
  let scrollRef: ScrollBoxRenderable | undefined
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null)

  const visibleHeight = createMemo(() => dimensions().height - 3)

  onMount(async () => {
    if (props.filePath) {
      const readOnlyCheck = await checkReadOnly(props.filePath)
      if (readOnlyCheck.isReadOnly) {
        setEditorState((s) => ({
          ...s,
          isReadOnly: true,
          isReadOnlyReason: readOnlyCheck.reason,
        }))
      }
    }
  })

  const ensureCursorVisible = () => {
    if (!scrollRef) return
    const state = editorState()
    const cursorY = state.cursorLine
    const viewportHeight = scrollRef.height
    const scrollTop = scrollRef.scrollTop

    if (cursorY < scrollTop) {
      scrollRef.scrollTo(cursorY)
    } else if (cursorY >= scrollTop + viewportHeight) {
      scrollRef.scrollTo(cursorY - viewportHeight + 1)
    }
  }

  const pushUndo = (
    beforeState: EditorState,
    afterState: EditorState,
    type: "insert_char" | "delete_char" | "insert_line" | "delete_line" | "join_lines" | "split_line"
  ) => {
    const operation = createUndoOperation(type, beforeState, afterState)
    setUndoState((s) => pushUndoOperation(s, operation))
  }

  const handleQuit = async () => {
    const state = editorState()
    const quit = quitState()

    if (quit.shouldQuit) {
      if (quit.quitAction === "save_and_quit") {
        const result = await handleSaveAndQuit(state)
        if (result.success) {
          setEditorState(result.newState)
          setUndoState((s) => clearUndoStack(s))
        } else {
          setStatusMessage(result.error ?? "Failed to save")
          setQuitState(createQuitState())
          return
        }
      }
      if (!props.embedded) {
        renderer.destroy()
      }
      props.onExit()
    }
  }

  const showTemporaryMessage = (message: string, duration = 2000) => {
    setStatusMessage(message)
    setTimeout(() => setStatusMessage(null), duration)
  }

  useKeyboard(async (key) => {
    const state = editorState()
    const save = saveState()
    const command = commandState()
    const quit = quitState()

    if (quit.shouldQuit) {
      await handleQuit()
      return
    }

    if (quit.promptState === "confirming") {
      if (key.name === "y") {
        setQuitState((s) => confirmQuitWithSave(s))
        await handleQuit()
        return
      }
      if (key.name === "n") {
        setQuitState((s) => confirmQuitWithoutSave(s))
        await handleQuit()
        return
      }
      if (key.name === "c" || key.name === "escape") {
        setQuitState((s) => cancelQuitConfirmation(s))
        return
      }
      return
    }

    if (save.promptState === "confirming") {
      if (key.name === "y") {
        const result = await performSave(state)
        if (result.success) {
          setEditorState((s) => markAsSaved(s))
          setUndoState((s) => clearUndoStack(s))
          setSaveState((s) => setSavedMessage(s))
          showTemporaryMessage("Saved", 2000)
        } else {
          showTemporaryMessage(result.error ?? "Failed to save", 2000)
        }
        setSaveState(createSaveState())
        return
      }
      if (key.name === "n" || key.name === "escape") {
        setSaveState((s) => cancelSaveConfirmation(s))
        return
      }
      return
    }

    if (command.mode === "active") {
      if (key.name === "escape") {
        setCommandState((s) => cancelCommandMode(s))
        return
      }
      if (key.name === "return") {
        const { command: cmd, state: newCmdState } = executeCommand(command)
        setCommandState(newCmdState)
        const parsed = parseCommand(cmd)

        if (parsed.type === "save") {
          if (state.filePath) {
            setSaveState((s) => startSaveConfirmation(s, state.filePath!))
          } else {
            showTemporaryMessage("No file path specified", 2000)
          }
        } else if (parsed.type === "quit") {
          if (canQuitImmediately(state)) {
            if (!props.embedded) {
              renderer.destroy()
            }
            props.onExit()
          } else {
            setQuitState((s) => startQuitConfirmation(s))
          }
        } else if (parsed.type === "save_quit") {
          if (state.isDirty) {
            const result = await performSave(state)
            if (result.success) {
              setEditorState((s) => markAsSaved(s))
              setUndoState((s) => clearUndoStack(s))
              if (!props.embedded) {
                renderer.destroy()
              }
              props.onExit()
            } else {
              showTemporaryMessage(result.error ?? "Failed to save", 2000)
            }
          } else {
            if (!props.embedded) {
              renderer.destroy()
            }
            props.onExit()
          }
        } else if (parsed.type === "force_quit") {
          setQuitState((s) => forceQuit(s))
          await handleQuit()
        } else if (parsed.type === "unknown") {
          showTemporaryMessage(`Unknown command: ${parsed.command}`, 2000)
        }
        return
      }
      if (key.name === "backspace") {
        setCommandState((s) => deleteFromCommand(s))
        return
      }
      const char = getPrintableChar(key.sequence ?? "")
      if (char) {
        setCommandState((s) => appendToCommand(s, char))
      }
      return
    }

    if (shouldTriggerSave(key)) {
      if (state.filePath) {
        setSaveState((s) => startSaveConfirmation(s, state.filePath!))
      } else {
        showTemporaryMessage("No file path specified", 2000)
      }
      return
    }

    if (state.mode === "normal") {
      if (shouldStartCommandMode(state, key)) {
        setCommandState((s) => startCommandMode(s))
        return
      }

      if (key.name === "escape" || (key.name === "q" && props.embedded)) {
        if (canQuitImmediately(state)) {
          props.onExit()
        } else {
          setQuitState((s) => startQuitConfirmation(s))
        }
        return
      }

      if (key.name === "h" || key.name === "left") {
        setEditorState((s) => moveLeft(s))
        ensureCursorVisible()
        setLastKey("h")
        return
      }
      if (key.name === "l" || key.name === "right") {
        setEditorState((s) => moveRight(s))
        ensureCursorVisible()
        setLastKey("l")
        return
      }
      if (key.name === "j" || key.name === "down") {
        setEditorState((s) => moveDown(s))
        ensureCursorVisible()
        setLastKey("j")
        return
      }
      if (key.name === "k" || key.name === "up") {
        setEditorState((s) => moveUp(s))
        ensureCursorVisible()
        setLastKey("k")
        return
      }
      if (key.name === "0") {
        setEditorState((s) => moveToLineStart(s))
        setLastKey("0")
        return
      }
      if (key.sequence === "$") {
        setEditorState((s) => moveToLineEnd(s))
        setLastKey("$")
        return
      }
      if (key.name === "g" && lastKey() === "g") {
        setEditorState((s) => moveToFirstLine(s))
        ensureCursorVisible()
        setLastKey(null)
        return
      }
      if (key.sequence === "G") {
        setEditorState((s) => moveToLastLine(s))
        ensureCursorVisible()
        setLastKey(null)
        return
      }
      if (key.name === "g") {
        setLastKey("g")
        return
      }
      if (key.name === "w") {
        setEditorState((s) => moveToNextWord(s))
        ensureCursorVisible()
        setLastKey("w")
        return
      }
      if (key.name === "b") {
        setEditorState((s) => moveToPreviousWord(s))
        ensureCursorVisible()
        setLastKey("b")
        return
      }

      if (key.name === "i") {
        if (state.isReadOnly) {
          showTemporaryMessage(getReadOnlyReasonMessage(state.isReadOnlyReason), 2000)
          return
        }
        setEditorState((s) => enterInsertMode(s))
        setLastKey("i")
        return
      }
      if (key.name === "a") {
        if (state.isReadOnly) {
          showTemporaryMessage(getReadOnlyReasonMessage(state.isReadOnlyReason), 2000)
          return
        }
        setEditorState((s) => enterInsertModeAfter(s))
        setLastKey("a")
        return
      }
      if (key.sequence === "A") {
        if (state.isReadOnly) {
          showTemporaryMessage(getReadOnlyReasonMessage(state.isReadOnlyReason), 2000)
          return
        }
        setEditorState((s) => enterInsertModeAtEnd(s))
        setLastKey("A")
        return
      }
      if (key.sequence === "I") {
        if (state.isReadOnly) {
          showTemporaryMessage(getReadOnlyReasonMessage(state.isReadOnlyReason), 2000)
          return
        }
        setEditorState((s) => enterInsertModeAtStart(s))
        setLastKey("I")
        return
      }
      if (key.name === "o") {
        if (state.isReadOnly) {
          showTemporaryMessage(getReadOnlyReasonMessage(state.isReadOnlyReason), 2000)
          return
        }
        const before = state
        setEditorState((s) => openLineBelow(s))
        pushUndo(before, editorState(), "insert_line")
        ensureCursorVisible()
        setLastKey("o")
        return
      }
      if (key.sequence === "O") {
        if (state.isReadOnly) {
          showTemporaryMessage(getReadOnlyReasonMessage(state.isReadOnlyReason), 2000)
          return
        }
        const before = state
        setEditorState((s) => openLineAbove(s))
        pushUndo(before, editorState(), "insert_line")
        ensureCursorVisible()
        setLastKey("O")
        return
      }

      if (shouldTriggerDeleteCharUnderCursor(key, state.mode)) {
        if (state.isReadOnly) {
          showTemporaryMessage(getReadOnlyReasonMessage(state.isReadOnlyReason), 2000)
          return
        }
        const before = state
        setEditorState((s) => deleteCharUnderCursor(s))
        pushUndo(before, editorState(), "delete_char")
        setLastKey("x")
        return
      }

      if (shouldTriggerUndo(key)) {
        const result = performUndo(state, undoState())
        setEditorState(result.editorState)
        setUndoState(result.undoState)
        ensureCursorVisible()
        setLastKey("u")
        return
      }
      if (shouldTriggerRedo(key)) {
        const result = performRedo(state, undoState())
        setEditorState(result.editorState)
        setUndoState(result.undoState)
        ensureCursorVisible()
        setLastKey(null)
        return
      }

      if (shouldTriggerYankLine(key, lastKey())) {
        setClipboardState((s) => yankLine(state, s))
        showTemporaryMessage("1 line yanked", 1500)
        setLastKey(null)
        return
      }
      if (key.name === "y") {
        setLastKey("y")
        return
      }
      if (shouldTriggerDeleteLine(key, lastKey())) {
        if (state.isReadOnly) {
          showTemporaryMessage(getReadOnlyReasonMessage(state.isReadOnlyReason), 2000)
          setLastKey(null)
          return
        }
        const before = state
        const result = deleteLine(state, clipboardState())
        setEditorState(result.editorState)
        setClipboardState(result.clipboardState)
        pushUndo(before, result.editorState, "delete_line")
        ensureCursorVisible()
        setLastKey(null)
        return
      }
      if (key.name === "d") {
        setLastKey("d")
        return
      }
      if (shouldTriggerPasteAfter(key) && !shouldTriggerPasteBefore(key)) {
        if (state.isReadOnly) {
          showTemporaryMessage(getReadOnlyReasonMessage(state.isReadOnlyReason), 2000)
          return
        }
        const before = state
        setEditorState((s) => pasteAfter(s, clipboardState()))
        pushUndo(before, editorState(), "insert_line")
        ensureCursorVisible()
        setLastKey("p")
        return
      }
      if (shouldTriggerPasteBefore(key)) {
        if (state.isReadOnly) {
          showTemporaryMessage(getReadOnlyReasonMessage(state.isReadOnlyReason), 2000)
          return
        }
        const before = state
        setEditorState((s) => pasteBefore(s, clipboardState()))
        pushUndo(before, editorState(), "insert_line")
        ensureCursorVisible()
        setLastKey("P")
        return
      }

      setLastKey(key.name ?? null)
      return
    }

    if (state.mode === "insert") {
      if (key.name === "escape") {
        setEditorState((s) => exitInsertMode(s))
        setLastKey(null)
        return
      }
      if (key.name === "backspace") {
        const before = state
        setEditorState((s) => deleteCharBefore(s))
        const after = editorState()
        if (before.lines !== after.lines) {
          pushUndo(before, after, before.cursorCol === 0 ? "join_lines" : "delete_char")
        }
        ensureCursorVisible()
        return
      }
      if (key.name === "return") {
        const before = state
        setEditorState((s) => insertNewLine(s))
        pushUndo(before, editorState(), "split_line")
        ensureCursorVisible()
        return
      }
      if (key.name === "up") {
        setEditorState((s) => moveUp(s))
        ensureCursorVisible()
        return
      }
      if (key.name === "down") {
        setEditorState((s) => moveDown(s))
        ensureCursorVisible()
        return
      }
      if (key.name === "left") {
        setEditorState((s) => moveLeft(s))
        ensureCursorVisible()
        return
      }
      if (key.name === "right") {
        setEditorState((s) => moveRight(s))
        ensureCursorVisible()
        return
      }

      const char = getPrintableChar(key.sequence ?? "")
      if (char) {
        const before = state
        setEditorState((s) => insertChar(s, char))
        pushUndo(before, editorState(), "insert_char")
        return
      }
    }
  })

  const allLines = createMemo(() => editorState().lines)

  const displayTitle = createMemo(() => {
    const state = editorState()
    return getTitleWithDirtyIndicator(props.title, state.isDirty)
  })

  const statusBar = createMemo(() => {
    const state = editorState()
    const command = commandState()
    const save = saveState()
    const quit = quitState()
    const message = statusMessage()

    const commandPrompt = getCommandPrompt(command)
    if (commandPrompt) {
      return commandPrompt
    }

    const quitPrompt = getQuitPrompt(quit)
    if (quitPrompt) {
      return quitPrompt
    }

    if (save.promptState === "confirming" && save.message) {
      return save.message
    }

    if (message) {
      return message
    }

    const mode = getModeIndicator(state)
    const readOnly = getReadOnlyStatusIndicator(state.isReadOnly)
    const position = `Line ${state.cursorLine + 1}/${state.lines.length} Col ${state.cursorCol + 1}`
    const dirtyIndicator = state.isDirty ? " *" : ""

    const statusParts = [mode, props.title + dirtyIndicator]
    if (readOnly) {
      statusParts.push(readOnly)
    }
    statusParts.push(position)
    return statusParts.join(" ")
  })

  const statusBarColor = createMemo(() => {
    const state = editorState()
    return state.mode === "insert" ? "#00aa00" : "#808080"
  })

  return (
    <box flexDirection="column" width={dimensions().width} height={dimensions().height}>
      <box
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={1}
        paddingRight={1}
        backgroundColor="#222222"
      >
        <text attributes={TextAttributes.BOLD} fg="#00ffff">
          {displayTitle()}
        </text>
        <text fg="#808080">
          Line {editorState().cursorLine + 1}/{editorState().lines.length}
        </text>
      </box>

      <scrollbox ref={(r: ScrollBoxRenderable) => (scrollRef = r)} height={visibleHeight()} flexGrow={1}>
        <Index each={allLines()}>
          {(line, i) => {
            const isCursorLine = () => i === editorState().cursorLine
            const isLineDirty = () => editorState().dirtyLines.has(i)
            const cursorCol = () => editorState().cursorCol

            const lineNumWidth = 5
            const maxLineWidth = () => dimensions().width - lineNumWidth - 2
            const displayLine = () => {
              const l = line()
              return l.length > maxLineWidth() ? l.slice(0, maxLineWidth() - 1) + "…" : l
            }
            const lineContent = () => displayLine() || " "
            const textColor = () => (isLineDirty() ? "#88ff88" : "#ffffff")
            const lineNumColor = () => (isLineDirty() ? "#88ff88" : "#555555")

            const handleLineClick = (e: MouseEvent) => {
              const lineNumWidth = 5
              const clickCol = Math.max(0, e.x - lineNumWidth)
              const lineLen = line().length
              const clampedCol = Math.min(clickCol, Math.max(0, lineLen - 1))

              setEditorState((s) => ({
                ...s,
                cursorLine: i,
                cursorCol: s.mode === "insert" ? Math.min(clickCol, lineLen) : clampedCol,
              }))
            }

            return (
              <box
                flexDirection="row"
                backgroundColor={isCursorLine() ? "#333366" : undefined}
                width={dimensions().width}
                onMouseDown={handleLineClick}
              >
                <text fg={lineNumColor()}>{(i + 1).toString().padStart(4)} </text>
                <Show
                  when={isCursorLine()}
                  fallback={<text fg={textColor()}>{lineContent()}</text>}
                >
                  <box flexDirection="row">
                    <text fg={textColor()}>{lineContent().slice(0, cursorCol())}</text>
                    <box backgroundColor="#ffffff">
                      <text fg="#000000" attributes={TextAttributes.BOLD}>
                        {lineContent()[cursorCol()] ?? " "}
                      </text>
                    </box>
                    <text fg={textColor()}>{lineContent().slice(cursorCol() + 1)}</text>
                  </box>
                </Show>
              </box>
            )
          }}
        </Index>
      </scrollbox>

      <box paddingLeft={1} paddingRight={1} backgroundColor="#222222">
        <text fg={statusBarColor()}>{statusBar()}</text>
      </box>
    </box>
  )
}
