import { createSignal, Switch, Match } from "solid-js"
import { render } from "@opentui/solid"
import { TreeBrowser } from "./tree-browser"
import { Document } from "./document"
import type { DocumentConfig } from "./document/types"
import { checkReadOnly } from "./editor/editor-readonly"

export interface TreeFileViewerConfig {
  path?: string
  showHidden?: boolean
}

export interface TreeFileViewerProps {
  id: string
  config?: TreeFileViewerConfig
  socketPath?: string
  scenario: string
  onExit: () => void
}

const VIEWABLE_EXTENSIONS = new Set([
  "md",
  "txt",
  "json",
  "yaml",
  "yml",
  "toml",
  "ts",
  "tsx",
  "js",
  "jsx",
  "css",
  "html",
  "xml",
  "sh",
  "bash",
  "zsh",
  "py",
  "rb",
  "go",
  "rs",
  "c",
  "cpp",
  "h",
  "hpp",
  "java",
  "kt",
  "swift",
  "sql",
  "graphql",
  "env",
  "gitignore",
  "dockerignore",
  "editorconfig",
  "prettierrc",
  "eslintrc",
])

function isViewable(path: string): boolean {
  const name = path.split("/").pop() || ""
  if (name.startsWith(".") && !name.includes(".", 1)) {
    return true
  }
  const ext = name.split(".").pop()?.toLowerCase() || ""
  return VIEWABLE_EXTENSIONS.has(ext)
}

async function loadFileContent(path: string): Promise<DocumentConfig> {
  const file = Bun.file(path)
  const content = await file.text()
  const filename = path.split("/").pop() || path
  const ext = filename.split(".").pop()?.toLowerCase() || ""

  return {
    content,
    title: filename,
    format: ext === "md" ? "markdown" : "plain",
    readOnly: true,
  }
}

export function TreeFileViewer(props: TreeFileViewerProps) {
  const [mode, setMode] = createSignal<"browse" | "view" | "edit">("browse")
  const [docConfig, setDocConfig] = createSignal<DocumentConfig | null>(null)
  const [viewingPath, setViewingPath] = createSignal<string | null>(null)
  const [isEditable, setIsEditable] = createSignal(false)

  const openFile = async (path: string) => {
    if (!isViewable(path)) {
      return
    }

    const config = await loadFileContent(path)
    const readOnlyCheck = await checkReadOnly(path)
    setDocConfig(config)
    setViewingPath(path)
    setIsEditable(!readOnlyCheck.isReadOnly)
    setMode("view")
  }

  const enterEditMode = () => {
    if (isEditable()) {
      setMode("edit")
    }
  }

  const goBack = () => {
    setMode("browse")
    setDocConfig(null)
    setViewingPath(null)
  }

  const goBackToView = async () => {
    const path = viewingPath()
    if (path) {
      const config = await loadFileContent(path)
      setDocConfig(config)
    }
    setMode("view")
  }

  return (
    <Switch>
      <Match when={mode() === "browse" || !docConfig()}>
        <TreeBrowser
          id={props.id}
          config={{ path: props.config?.path, showHidden: props.config?.showHidden }}
          socketPath={props.socketPath}
          scenario={props.scenario}
          onExit={props.onExit}
          onOpenFile={openFile}
        />
      </Match>
      <Match when={mode() !== "browse" && docConfig()}>
        <Document
          id={props.id}
          config={docConfig()!}
          socketPath={props.socketPath}
          scenario="view"
          onExit={mode() === "edit" ? goBackToView : goBack}
          embedded
          editable={mode() === "edit"}
          filePath={viewingPath() ?? undefined}
          onEnterEdit={enterEditMode}
          canEdit={isEditable()}
        />
      </Match>
    </Switch>
  )
}

export async function renderTreeFileViewer(
  id: string,
  config?: TreeFileViewerConfig,
  options?: { socketPath?: string; scenario?: string }
): Promise<void> {
  return new Promise<void>((resolve) => {
    render(
      () => (
        <TreeFileViewer
          id={id}
          config={config}
          socketPath={options?.socketPath}
          scenario={options?.scenario || "browse"}
          onExit={resolve}
        />
      ),
      { exitOnCtrlC: false }
    )
  })
}
