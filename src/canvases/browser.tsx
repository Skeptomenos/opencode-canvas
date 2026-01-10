import { createSignal, createMemo, For, onMount } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import type { ScrollBoxRenderable } from "@opentui/core"
import { useIPCServer } from "./calendar/hooks/use-ipc-server"

export interface BrowserConfig {
  path?: string
  showHidden?: boolean
  fileFilter?: string[]
}

export interface BrowserProps {
  id: string
  config?: BrowserConfig
  socketPath?: string
  scenario: string
  onExit: () => void
  onOpenFile?: (path: string) => void
}

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: Date
}

async function readDirectory(dirPath: string, showHidden: boolean): Promise<FileEntry[]> {
  const entries: FileEntry[] = []
  const glob = new Bun.Glob("*")

  for await (const name of glob.scan({ cwd: dirPath, onlyFiles: false, dot: showHidden })) {
    const fullPath = `${dirPath}/${name}`
    const file = Bun.file(fullPath)
    const isDir = await isDirectory(fullPath)

    entries.push({
      name,
      path: fullPath,
      isDirectory: isDir,
      size: isDir ? 0 : file.size,
      modified: new Date(),
    })
  }

  entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })

  return entries
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const proc = Bun.spawnSync(["test", "-d", path])
    return proc.exitCode === 0
  } catch {
    return false
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return ""
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`
}

function getFileIcon(entry: FileEntry): string {
  if (entry.isDirectory) return "[D]"
  const ext = entry.name.split(".").pop()?.toLowerCase() || ""
  const icons: Record<string, string> = {
    md: "[M]",
    txt: "[T]",
    ts: "[S]",
    tsx: "[X]",
    js: "[J]",
    jsx: "[X]",
    json: "[N]",
    yaml: "[Y]",
    yml: "[Y]",
    css: "[C]",
    html: "[H]",
    png: "[I]",
    jpg: "[I]",
    jpeg: "[I]",
    gif: "[I]",
    svg: "[I]",
    pdf: "[P]",
    zip: "[Z]",
    tar: "[Z]",
    gz: "[Z]",
  }
  return icons[ext] || "[F]"
}

export function FileBrowser(props: BrowserProps) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()

  const [currentPath, setCurrentPath] = createSignal(props.config?.path || process.cwd())
  const [entries, setEntries] = createSignal<FileEntry[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [loading, setLoading] = createSignal(true)
  let scrollRef: ScrollBoxRenderable | undefined
  const [error, setError] = createSignal<string | null>(null)
  const [showHidden, setShowHidden] = createSignal(props.config?.showHidden ?? false)

  const visibleHeight = createMemo(() => dimensions().height - 5)

  const loadDirectory = async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const items = await readDirectory(path, showHidden())
      setEntries(items)
      setSelectedIndex(0)
      if (scrollRef) scrollRef.scrollTo(0)
      setCurrentPath(path)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read directory")
    } finally {
      setLoading(false)
    }
  }

  const ipc = useIPCServer({
    socketPath: props.socketPath,
    scenario: props.scenario,
    onClose: props.onExit,
    onGetSelection: () => {
      const entry = entries()[selectedIndex()]
      return entry ? { selectedText: entry.path, startOffset: 0, endOffset: 0 } : null
    },
    onGetContent: () => ({ content: currentPath(), cursorPosition: selectedIndex() }),
  })

  onMount(() => {
    loadDirectory(currentPath())
    ipc.sendReady()
  })

  const navigateUp = () => {
    const parent = currentPath().split("/").slice(0, -1).join("/") || "/"
    loadDirectory(parent)
  }

  const openSelected = () => {
    const entry = entries()[selectedIndex()]
    if (!entry) return

    if (entry.isDirectory) {
      loadDirectory(entry.path)
    } else {
      ipc.sendSelected({ selectedText: entry.path, startOffset: 0, endOffset: 0 })
      if (props.onOpenFile) {
        props.onOpenFile(entry.path)
      }
    }
  }

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      ipc.sendCancelled("User cancelled")
      renderer.destroy()
      props.onExit()
      return
    }

    const ensureSelectedVisible = () => {
      if (!scrollRef) return
      const idx = selectedIndex()
      const viewportHeight = scrollRef.height
      const scrollTop = scrollRef.scrollTop
      if (idx < scrollTop) {
        scrollRef.scrollTo(idx)
      } else if (idx >= scrollTop + viewportHeight) {
        scrollRef.scrollTo(idx - viewportHeight + 1)
      }
    }

    if (key.name === "up" || key.name === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1))
      ensureSelectedVisible()
    }

    if (key.name === "down" || key.name === "j") {
      setSelectedIndex((i) => Math.min(entries().length - 1, i + 1))
      ensureSelectedVisible()
    }

    if (key.name === "return" || key.name === "right" || key.name === "l") {
      openSelected()
    }

    if (key.name === "left" || key.name === "h" || key.name === "backspace") {
      navigateUp()
    }

    if (key.name === "home" || key.name === "g") {
      setSelectedIndex(0)
      if (scrollRef) scrollRef.scrollTo(0)
    }

    if (key.name === "end") {
      setSelectedIndex(entries().length - 1)
      if (scrollRef) scrollRef.scrollTo(scrollRef.scrollHeight)
    }

    if (key.name === "pageup") {
      const jump = visibleHeight()
      setSelectedIndex((i) => Math.max(0, i - jump))
      if (scrollRef) scrollRef.scrollBy(-jump)
    }

    if (key.name === "pagedown") {
      const jump = visibleHeight()
      setSelectedIndex((i) => Math.min(entries().length - 1, i + jump))
      if (scrollRef) scrollRef.scrollBy(jump)
    }

    if (key.name === "." || (key.ctrl && key.name === "h")) {
      setShowHidden(!showHidden())
      loadDirectory(currentPath())
    }

    if (key.name === "r" || key.name === "f5") {
      loadDirectory(currentPath())
    }

    if (key.name === "~") {
      loadDirectory(process.env.HOME || "/")
    }
  })

  const allEntries = createMemo(() => entries())

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
          {currentPath()}
        </text>
        <text fg="#808080">
          {entries().length} items {showHidden() ? "(hidden shown)" : ""}
        </text>
      </box>

      <box paddingLeft={1} backgroundColor="#1a1a1a">
        <text fg="#666666">
          {selectedIndex() + 1}/{entries().length}
        </text>
      </box>

      {loading() ? (
        <box paddingLeft={2} paddingTop={1}>
          <text fg="#888888">Loading...</text>
        </box>
      ) : error() ? (
        <box paddingLeft={2} paddingTop={1}>
          <text fg="#ff4444">Error: {error()}</text>
        </box>
      ) : entries().length === 0 ? (
        <box paddingLeft={2} paddingTop={1}>
          <text fg="#888888">Empty directory</text>
        </box>
      ) : (
        <scrollbox ref={(r: ScrollBoxRenderable) => (scrollRef = r)} height={visibleHeight()} flexGrow={1}>
          <For each={allEntries()}>
            {(entry, i) => {
              const idx = i()
              const isSelected = () => idx === selectedIndex()

              return (
                <box
                  flexDirection="row"
                  backgroundColor={isSelected() ? "#333366" : undefined}
                  width={dimensions().width}
                  paddingLeft={1}
                >
                  <text fg="#888888">{getFileIcon(entry)} </text>
                  <text
                    attributes={isSelected() ? TextAttributes.BOLD : 0}
                    fg={entry.isDirectory ? "#00aaff" : "#ffffff"}
                  >
                    {entry.name}
                    {entry.isDirectory ? "/" : ""}
                  </text>
                  <text fg="#666666"> {formatSize(entry.size)}</text>
                </box>
              )
            }}
          </For>
        </scrollbox>
      )}

      <box paddingLeft={1} paddingRight={1} backgroundColor="#222222">
        <text fg="#808080">[↑/↓] Navigate [Enter/→] Open [←/Backspace] Up [.] Toggle hidden [~] Home [q] Quit</text>
      </box>
    </box>
  )
}
