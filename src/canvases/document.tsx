import { createSignal, createMemo, For, onMount } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import type { DocumentConfig, DocumentSelection, DocumentContent } from "./document/types"
import { useIPCServer } from "./calendar/hooks/use-ipc-server"

export interface DocumentProps {
  id: string
  config?: DocumentConfig
  socketPath?: string
  scenario: string
  onExit: () => void
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
  const [scrollOffset, setScrollOffset] = createSignal(0)
  const [cursorLine, setCursorLine] = createSignal(0)
  const [selectionStart, setSelectionStart] = createSignal<number | null>(null)
  const [selectionEnd, setSelectionEnd] = createSignal<number | null>(null)

  const visibleHeight = createMemo(() => dimensions().height - 4)

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

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      ipc.sendCancelled("User cancelled")
      renderer.destroy()
      props.onExit()
      return
    }

    if (key.name === "up") {
      setCursorLine((l) => Math.max(0, l - 1))
      if (cursorLine() < scrollOffset()) {
        setScrollOffset(cursorLine())
      }
    }

    if (key.name === "down") {
      setCursorLine((l) => Math.min(lines().length - 1, l + 1))
      if (cursorLine() >= scrollOffset() + visibleHeight()) {
        setScrollOffset(cursorLine() - visibleHeight() + 1)
      }
    }

    if (key.name === "pageup") {
      const jump = visibleHeight()
      setCursorLine((l) => Math.max(0, l - jump))
      setScrollOffset((o) => Math.max(0, o - jump))
    }

    if (key.name === "pagedown") {
      const jump = visibleHeight()
      setCursorLine((l) => Math.min(lines().length - 1, l + jump))
      setScrollOffset((o) => Math.min(Math.max(0, lines().length - visibleHeight()), o + jump))
    }

    if (key.name === "home" || (key.ctrl && key.name === "a")) {
      setCursorLine(0)
      setScrollOffset(0)
    }

    if (key.name === "end" || (key.ctrl && key.name === "e")) {
      setCursorLine(lines().length - 1)
      setScrollOffset(Math.max(0, lines().length - visibleHeight()))
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

  const visibleLines = createMemo(() => {
    const offset = scrollOffset()
    const height = visibleHeight()
    return lines().slice(offset, offset + height)
  })

  const isLineSelected = (lineIndex: number): boolean => {
    const start = selectionStart()
    const end = selectionEnd()
    if (start === null || end === null) return false
    const minLine = Math.min(start, end)
    const maxLine = Math.max(start, end)
    return lineIndex >= minLine && lineIndex <= maxLine
  }

  const formatLine = (line: string, lineNum: number): string => {
    if (format === "markdown") {
      if (line.startsWith("# ")) return line
      if (line.startsWith("## ")) return line
      if (line.startsWith("### ")) return line
      if (line.startsWith("- ") || line.startsWith("* ")) return line
      if (line.match(/^\d+\. /)) return line
    }
    return line
  }

  const getLineColor = (line: string): string => {
    if (format === "markdown") {
      if (line.startsWith("# ")) return "#00ffff"
      if (line.startsWith("## ")) return "#00cccc"
      if (line.startsWith("### ")) return "#009999"
      if (line.startsWith("```")) return "#888888"
      if (line.startsWith("> ")) return "#888888"
      if (line.startsWith("- ") || line.startsWith("* ")) return "#aaaaaa"
    }
    return "#ffffff"
  }

  return (
    <box flexDirection="column" width={dimensions().width} height={dimensions().height}>
      <box flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1} backgroundColor="#222222">
        <text attributes={TextAttributes.BOLD} fg="#00ffff">
          {title}
        </text>
        <text fg="#808080">
          Line {cursorLine() + 1}/{lines().length}
        </text>
      </box>

      {config.emailHeaders && (
        <box flexDirection="column" paddingLeft={1} paddingRight={1} backgroundColor="#1a1a1a">
          {config.emailHeaders.from && (
            <text fg="#808080">From: {config.emailHeaders.from}</text>
          )}
          {config.emailHeaders.to && (
            <text fg="#808080">To: {config.emailHeaders.to}</text>
          )}
          {config.emailHeaders.subject && (
            <text fg="#aaaaaa">Subject: {config.emailHeaders.subject}</text>
          )}
        </box>
      )}

      <scrollbox height={visibleHeight()} flexGrow={1}>
        <For each={visibleLines()}>
          {(line, i) => {
            const actualLineIndex = scrollOffset() + i()
            const isCursor = actualLineIndex === cursorLine()
            const isSelected = isLineSelected(actualLineIndex)

            return (
              <box
                backgroundColor={isCursor ? "#333366" : isSelected ? "#333333" : undefined}
                width={dimensions().width}
              >
                <box width={5} paddingRight={1}>
                  <text fg="#555555">{(actualLineIndex + 1).toString().padStart(4)}</text>
                </box>
                <text
                  attributes={isCursor ? TextAttributes.BOLD : 0}
                  fg={getLineColor(line)}
                >
                  {formatLine(line, actualLineIndex) || " "}
                </text>
              </box>
            )
          }}
        </For>
      </scrollbox>

      <box paddingLeft={1} paddingRight={1} backgroundColor="#222222">
        <text fg="#808080">
          [↑/↓] Navigate [PgUp/PgDn] Page [Shift+↑/↓] Select [Enter] Confirm [q] Quit
        </text>
      </box>
    </box>
  )
}
