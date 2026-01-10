import { createSignal, createMemo, For, onMount } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import type { ScrollBoxRenderable } from "@opentui/core"
import { useIPCServer } from "./calendar/hooks/use-ipc-server"

export interface TreeBrowserConfig {
  path?: string
  showHidden?: boolean
}

export interface TreeBrowserProps {
  id: string
  config?: TreeBrowserConfig
  socketPath?: string
  scenario: string
  onExit: () => void
  onOpenFile?: (path: string) => void
}

interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  size: number
  depth: number
  expanded: boolean
  children: TreeNode[]
  loaded: boolean
}

async function readDirectory(dirPath: string, showHidden: boolean): Promise<TreeNode[]> {
  const entries: TreeNode[] = []
  const glob = new Bun.Glob("*")

  try {
    for await (const name of glob.scan({ cwd: dirPath, onlyFiles: false, dot: showHidden })) {
      const fullPath = `${dirPath}/${name}`
      const isDir = await isDirectory(fullPath)
      const file = Bun.file(fullPath)

      entries.push({
        name,
        path: fullPath,
        isDirectory: isDir,
        size: isDir ? 0 : file.size,
        depth: 0,
        expanded: false,
        children: [],
        loaded: false,
      })
    }
  } catch {
    return []
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

function getFileIcon(node: TreeNode): string {
  if (node.isDirectory) {
    return node.expanded ? "[-]" : "[+]"
  }
  const ext = node.name.split(".").pop()?.toLowerCase() || ""
  const icons: Record<string, string> = {
    md: " M ",
    txt: " T ",
    ts: " S ",
    tsx: " X ",
    js: " J ",
    jsx: " X ",
    json: " N ",
    yaml: " Y ",
    yml: " Y ",
    css: " C ",
    html: " H ",
  }
  return icons[ext] || " . "
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = []
  const traverse = (items: TreeNode[], depth: number) => {
    for (const node of items) {
      result.push({ ...node, depth })
      if (node.isDirectory && node.expanded && node.children.length > 0) {
        traverse(node.children, depth + 1)
      }
    }
  }
  traverse(nodes, 0)
  return result
}

export function TreeBrowser(props: TreeBrowserProps) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()

  const [rootPath, setRootPath] = createSignal(props.config?.path || process.cwd())
  const [tree, setTree] = createSignal<TreeNode[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [loading, setLoading] = createSignal(true)
  let scrollRef: ScrollBoxRenderable | undefined
  const [showHidden, setShowHidden] = createSignal(props.config?.showHidden ?? false)

  const visibleHeight = createMemo(() => dimensions().height - 4)
  const flatNodes = createMemo(() => flattenTree(tree()))

  const loadRoot = async () => {
    setLoading(true)
    const entries = await readDirectory(rootPath(), showHidden())
    setTree(entries)
    setSelectedIndex(0)
    if (scrollRef) scrollRef.scrollTo(0)
    setLoading(false)
  }

  const toggleExpand = async (index: number) => {
    const nodes = flatNodes()
    const node = nodes[index]
    if (!node || !node.isDirectory) return

    const updateNode = async (items: TreeNode[], targetPath: string): Promise<TreeNode[]> => {
      const result: TreeNode[] = []
      for (const item of items) {
        if (item.path === targetPath) {
          if (!item.loaded) {
            const children = await readDirectory(item.path, showHidden())
            result.push({ ...item, expanded: true, children, loaded: true })
          } else {
            result.push({ ...item, expanded: !item.expanded })
          }
        } else if (item.isDirectory && item.children.length > 0) {
          result.push({ ...item, children: await updateNode(item.children, targetPath) })
        } else {
          result.push(item)
        }
      }
      return result
    }

    const updated = await updateNode(tree(), node.path)
    setTree(updated)
  }

  const ipc = useIPCServer({
    socketPath: props.socketPath,
    scenario: props.scenario,
    onClose: props.onExit,
    onGetSelection: () => {
      const node = flatNodes()[selectedIndex()]
      return node ? { selectedText: node.path, startOffset: 0, endOffset: 0 } : null
    },
    onGetContent: () => ({ content: rootPath(), cursorPosition: selectedIndex() }),
  })

  onMount(() => {
    loadRoot()
    ipc.sendReady()
  })

  const openSelected = async () => {
    const node = flatNodes()[selectedIndex()]
    if (!node) return

    if (node.isDirectory) {
      await toggleExpand(selectedIndex())
    } else {
      ipc.sendSelected({ selectedText: node.path, startOffset: 0, endOffset: 0 })
      if (props.onOpenFile) {
        props.onOpenFile(node.path)
      }
    }
  }

  const navigateUp = () => {
    const parent = rootPath().split("/").slice(0, -1).join("/") || "/"
    setRootPath(parent)
    loadRoot()
  }

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      ipc.sendCancelled("User cancelled")
      renderer.destroy()
      props.onExit()
      return
    }

    const nodes = flatNodes()

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
      setSelectedIndex((i) => Math.min(nodes.length - 1, i + 1))
      ensureSelectedVisible()
    }

    if (key.name === "return" || key.name === "l") {
      openSelected()
    }

    if (key.name === "right") {
      const node = nodes[selectedIndex()]
      if (node?.isDirectory && !node.expanded) {
        toggleExpand(selectedIndex())
      }
    }

    if (key.name === "left" || key.name === "h") {
      const node = nodes[selectedIndex()]
      if (node?.isDirectory && node.expanded) {
        toggleExpand(selectedIndex())
      } else if (node?.depth === 0) {
        navigateUp()
      } else if (node) {
        for (let i = selectedIndex() - 1; i >= 0; i--) {
          const parent = nodes[i]
          if (parent && parent.depth < node.depth && parent.isDirectory) {
            setSelectedIndex(i)
            break
          }
        }
      }
    }

    if (key.name === "backspace") {
      navigateUp()
    }

    if (key.name === "." || (key.ctrl && key.name === "h")) {
      setShowHidden(!showHidden())
      loadRoot()
    }

    if (key.name === "~") {
      setRootPath(process.env.HOME || "/")
      loadRoot()
    }

    if (key.name === "r") {
      loadRoot()
    }
  })

  const allNodes = createMemo(() => flatNodes())

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
          {rootPath()}
        </text>
        <text fg="#808080">{flatNodes().length} items</text>
      </box>

      <box flexDirection="row" paddingLeft={1} backgroundColor="#1a1a1a">
        <text fg="#666666">
          {selectedIndex() + 1}/{flatNodes().length}
        </text>
      </box>

      {loading() ? (
        <box paddingLeft={2} paddingTop={1}>
          <text fg="#888888">Loading...</text>
        </box>
      ) : flatNodes().length === 0 ? (
        <box paddingLeft={2} paddingTop={1}>
          <text fg="#888888">Empty directory</text>
        </box>
      ) : (
        <scrollbox ref={(r: ScrollBoxRenderable) => (scrollRef = r)} height={visibleHeight()} flexGrow={1}>
          <For each={allNodes()}>
            {(node, i) => {
              const idx = i()
              const isSelected = () => idx === selectedIndex()
              const indent = "  ".repeat(node.depth)

              return (
                <box
                  flexDirection="row"
                  backgroundColor={isSelected() ? "#333366" : undefined}
                  width={dimensions().width}
                  paddingLeft={1}
                >
                  <text fg="#444444">{indent}</text>
                  <text fg="#888888">{getFileIcon(node)} </text>
                  <text
                    attributes={isSelected() ? TextAttributes.BOLD : 0}
                    fg={node.isDirectory ? "#00aaff" : "#ffffff"}
                  >
                    {node.name}
                    {node.isDirectory ? "/" : ""}
                  </text>
                  <text fg="#666666"> {formatSize(node.size)}</text>
                </box>
              )
            }}
          </For>
        </scrollbox>
      )}

      <box flexDirection="row" paddingLeft={1} paddingRight={1} backgroundColor="#222222">
        <text fg="#808080">[↑/↓] Navigate [Enter/→] Expand/Open [←] Collapse [Backspace] Up [.] Hidden [q] Quit</text>
      </box>
    </box>
  )
}
