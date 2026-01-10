import { render } from "@opentui/solid"
import { Calendar } from "./calendar"
import { Document } from "./document"
import { FlightCanvas } from "./flight"
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
  process.on("exit", showCursor)
  process.on("SIGINT", () => {
    showCursor()
    process.exit()
  })

  switch (kind) {
    case "calendar":
      return renderCalendar(id, config as CalendarConfig, options)
    case "document":
      return renderDocument(id, config as DocumentConfig, options)
    case "flight":
      return renderFlight(id, config as FlightConfig, options)
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
