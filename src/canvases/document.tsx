import { createSignal, createMemo, For, onMount, Show } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import type { ScrollBoxRenderable } from "@opentui/core"
import type { DocumentConfig, DocumentSelection, DocumentContent } from "./document/types"
import { useIPCServer } from "./calendar/hooks/use-ipc-server"
import { MarkdownLine, isCodeFence } from "./markdown-renderer"
import { Editor } from "./editor/editor"
import { wrapLines, findDisplayLineIndex } from "./word-wrap"

export interface DocumentProps {
  id: string
  config?: DocumentConfig
  socketPath?: string
  scenario: string
  onExit: () => void
  embedded?: boolean
  editable?: boolean
  filePath?: string
  onEnterEdit?: () => void
  canEdit?: boolean
}

export function Document(props: DocumentProps) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()

  const config = props.config || {}
  const content = config.content || ""
  const title = config.title || "Document"
  const format = config.format || "markdown"
  const readOnly = config.readOnly ?? true

  const lines = createMemo(() => content.split("\n"))
  const [cursorLine, setCursorLine] = createSignal(0)
  let scrollRef: ScrollBoxRenderable | undefined
  const [selectionStart, setSelectionStart] = createSignal<number | null>(null)
  const [selectionEnd, setSelectionEnd] = createSignal<number | null>(null)

  const visibleHeight = createMemo(() => dimensions().height - 4)
  const lineNumWidth = 5
  const contentWidth = createMemo(() => dimensions().width - lineNumWidth - 2)

  const wrappedLines = createMemo(() => wrapLines(lines(), contentWidth()))

  const getSelection = (): DocumentSelection | null => {
    const start = selectionStart()
    const end = selectionEnd()
    if (start === null || end === null) return null

    const startLine = Math.min(start, end)
    const endLine = Math.max(start, end)
    const selectedLines = lines().slice(startLine, endLine + 1)

    return {
      selectedText: selectedLines.join("\n"),
      startOffset: startLine,
      endOffset: endLine,
    }
  }

  const getContent = (): DocumentContent => {
    return {
      content,
      cursorPosition: cursorLine(),
    }
  }

  const ipc = useIPCServer({
    socketPath: props.socketPath,
    scenario: props.scenario,
    onClose: props.onExit,
    onGetSelection: getSelection,
    onGetContent: getContent,
  })

  onMount(() => {
    ipc.sendReady()
  })

  const ensureCursorVisible = () => {
    if (!scrollRef) return
    const displayIndex = findDisplayLineIndex(wrappedLines(), cursorLine())
    const viewportHeight = scrollRef.height
    const scrollTop = scrollRef.scrollTop
    if (displayIndex < scrollTop) {
      scrollRef.scrollTo(displayIndex)
    } else if (displayIndex >= scrollTop + viewportHeight) {
      scrollRef.scrollTo(displayIndex - viewportHeight + 1)
    }
  }

  useKeyboard((key) => {
    if (props.editable) return

    const isEscape = key.name === "escape" || key.sequence === "\x1b"
    const isQuit = key.name === "q"

    if (props.embedded && (isEscape || isQuit)) {
      props.onExit()
      return
    }

    if (!props.embedded && isQuit) {
      ipc.sendCancelled("User cancelled")
      renderer.destroy()
      props.onExit()
      return
    }

    if (key.sequence === "e" && props.canEdit && props.onEnterEdit) {
      props.onEnterEdit()
      return
    }

    if (key.name === "up" || key.name === "k") {
      setCursorLine((l) => Math.max(0, l - 1))
      ensureCursorVisible()
      return
    }

    if (key.name === "down" || key.name === "j") {
      setCursorLine((l) => Math.min(lines().length - 1, l + 1))
      ensureCursorVisible()
      return
    }

    if (key.name === "pageup") {
      const jump = visibleHeight()
      setCursorLine((l) => Math.max(0, l - jump))
      if (scrollRef) scrollRef.scrollBy(-jump)
    }

    if (key.name === "pagedown") {
      const jump = visibleHeight()
      setCursorLine((l) => Math.min(lines().length - 1, l + jump))
      if (scrollRef) scrollRef.scrollBy(jump)
    }

    if (key.name === "home" || (key.ctrl && key.name === "a")) {
      setCursorLine(0)
      if (scrollRef) scrollRef.scrollTo(0)
    }

    if (key.name === "end" || (key.ctrl && key.name === "e")) {
      setCursorLine(lines().length - 1)
      if (scrollRef) scrollRef.scrollTo(scrollRef.scrollHeight)
    }

    if (key.shift && (key.name === "up" || key.name === "down")) {
      if (selectionStart() === null) {
        setSelectionStart(cursorLine())
      }
      setSelectionEnd(cursorLine())
    }

    if (key.name === "return") {
      const selection = getSelection()
      if (selection) {
        ipc.sendSelected(selection)
      }
    }
  })

  const allWrappedLines = createMemo(() => wrappedLines())

  const isLineSelected = (lineIndex: number): boolean => {
    const start = selectionStart()
    const end = selectionEnd()
    if (start === null || end === null) return false
    const minLine = Math.min(start, end)
    const maxLine = Math.max(start, end)
    return lineIndex >= minLine && lineIndex <= maxLine
  }

  const codeBlockState = createMemo(() => {
    const states: boolean[] = []
    let inCode = false
    for (const line of lines()) {
      if (isCodeFence(line)) {
        states.push(inCode)
        inCode = !inCode
      } else {
        states.push(inCode)
      }
    }
    return states
  })

  if (props.editable) {
    return (
      <Editor
        content={content}
        filePath={props.filePath ?? null}
        title={title}
        onExit={props.onExit}
        embedded={props.embedded}
      />
    )
  }

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
          {title}
        </text>
        <text fg="#808080">
          Line {cursorLine() + 1}/{lines().length}
        </text>
      </box>

      {config.emailHeaders && (
        <box flexDirection="column" paddingLeft={1} paddingRight={1} backgroundColor="#1a1a1a">
          {config.emailHeaders.from && <text fg="#808080">From: {config.emailHeaders.from}</text>}
          {config.emailHeaders.to && <text fg="#808080">To: {config.emailHeaders.to}</text>}
          {config.emailHeaders.subject && <text fg="#aaaaaa">Subject: {config.emailHeaders.subject}</text>}
        </box>
      )}

      <scrollbox ref={(r: ScrollBoxRenderable) => (scrollRef = r)} height={visibleHeight()} flexGrow={1}>
        <For each={allWrappedLines()}>
          {(wrappedLine) => {
            const originalIndex = wrappedLine.originalLineIndex
            const isCursor = () => originalIndex === cursorLine()
            const isSelected = () => isLineSelected(originalIndex)
            const inCodeBlock = () => codeBlockState()[originalIndex] || false
            const showLineNum = !wrappedLine.isWrapped

            return (
              <box
                flexDirection="row"
                backgroundColor={isCursor() ? "#333366" : isSelected() ? "#333333" : undefined}
                width={dimensions().width}
              >
                <text fg="#555555">{showLineNum ? (originalIndex + 1).toString().padStart(4) + " " : "     "}</text>
                {format === "markdown" ? (
                  <MarkdownLine line={wrappedLine.text || " "} inCodeBlock={inCodeBlock()} />
                ) : (
                  <text attributes={isCursor() ? TextAttributes.BOLD : 0} fg="#ffffff">
                    {wrappedLine.text || " "}
                  </text>
                )}
              </box>
            )
          }}
        </For>
      </scrollbox>

      <box paddingLeft={1} paddingRight={1} backgroundColor="#222222">
        <text fg="#808080">[↑/↓] Navigate [PgUp/PgDn] Page {props.canEdit ? "[e] Edit " : ""}[q] Quit</text>
      </box>
    </box>
  )
}
