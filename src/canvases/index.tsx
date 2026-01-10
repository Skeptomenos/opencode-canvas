import { render } from "@opentui/solid"
import { Calendar } from "./calendar"
import { Document } from "./document"
import { FlightCanvas } from "./flight"
import { FileBrowser, type BrowserConfig } from "./browser"
import { FileViewer, type FileViewerConfig } from "./file-viewer"
import { TreeBrowser, type TreeBrowserConfig } from "./tree-browser"
import { TreeFileViewer, type TreeFileViewerConfig } from "./tree-file-viewer"
import type { CalendarConfig } from "./calendar/types"
import type { DocumentConfig } from "./document/types"
import type { FlightConfig } from "./flight"

export interface RenderOptions {
  socketPath?: string
  scenario?: string
}

function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H\x1b[?25l")
}

function showCursor(): void {
  process.stdout.write("\x1b[?25h")
}

export async function renderCanvas(kind: string, id: string, config?: unknown, options?: RenderOptions): Promise<void> {
  clearScreen()

  const handleExit = () => {
    showCursor()
    process.exit(0)
  }

  process.on("exit", showCursor)
  process.on("SIGINT", handleExit)
  process.on("SIGTERM", handleExit)
  process.on("SIGHUP", handleExit)

  switch (kind) {
    case "calendar":
      return renderCalendar(id, config as CalendarConfig, options)
    case "document":
      return renderDocument(id, config as DocumentConfig, options)
    case "flight":
      return renderFlight(id, config as FlightConfig, options)
    case "browser":
      return renderBrowser(id, config as BrowserConfig, options)
    case "files":
      return renderFileViewer(id, config as FileViewerConfig, options)
    case "tree":
      return renderTreeFileViewer(id, config as TreeFileViewerConfig, options)
    default:
      console.error(`Unknown canvas: ${kind}`)
      process.exit(1)
  }
}

async function renderCalendar(id: string, config?: CalendarConfig, options?: RenderOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    render(
      () => (
        <Calendar
          id={id}
          config={config}
          socketPath={options?.socketPath}
          scenario={options?.scenario || "display"}
          onExit={resolve}
        />
      ),
      { exitOnCtrlC: false }
    )
  })
}

async function renderDocument(id: string, config?: DocumentConfig, options?: RenderOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    render(
      () => (
        <Document
          id={id}
          config={config}
          socketPath={options?.socketPath}
          scenario={options?.scenario || "display"}
          onExit={resolve}
          editable={config?.editable}
          filePath={config?.filePath}
        />
      ),
      { exitOnCtrlC: false }
    )
  })
}

async function renderFlight(id: string, config?: FlightConfig, options?: RenderOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    render(
      () => (
        <FlightCanvas
          id={id}
          config={config}
          socketPath={options?.socketPath}
          scenario={options?.scenario || "booking"}
          onExit={resolve}
        />
      ),
      { exitOnCtrlC: false }
    )
  })
}

async function renderBrowser(id: string, config?: BrowserConfig, options?: RenderOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    render(
      () => (
        <FileBrowser
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

async function renderFileViewer(id: string, config?: FileViewerConfig, options?: RenderOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    render(
      () => (
        <FileViewer
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

async function renderTreeFileViewer(id: string, config?: TreeFileViewerConfig, options?: RenderOptions): Promise<void> {
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
