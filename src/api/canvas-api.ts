import { createIPCServer, type IPCServer } from "@/ipc/server"
import { createIPCClient, type IPCClient } from "@/ipc/client"
import { getSocketPath, type CanvasMessage } from "@/ipc/types"
import { spawnCanvas } from "@/terminal"
import type { CalendarConfig, SelectedSlot } from "@/canvases/calendar/types"
import type { DocumentConfig, DocumentSelection } from "@/canvases/document/types"
import type { FlightConfig, Flight } from "@/canvases/flight"

export interface CanvasResult<T = unknown> {
  success: boolean
  data?: T
  cancelled?: boolean
  error?: string
}

export interface SpawnOptions {
  timeout?: number
  onReady?: () => void
}

export async function spawnCanvasWithIPC<TConfig, TResult>(
  kind: string,
  scenario: string,
  config: TConfig,
  options: SpawnOptions = {}
): Promise<CanvasResult<TResult>> {
  const { timeout = 300000, onReady } = options
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const socketPath = getSocketPath(id)

  return new Promise((resolve) => {
    let resolved = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let server: IPCServer | null = null

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      server?.close()
    }

    const handleResolve = (result: CanvasResult<TResult>) => {
      if (resolved) return
      resolved = true
      cleanup()
      resolve(result)
    }

    createIPCServer({
      socketPath,
      onMessage(msg) {
        const canvasMsg = msg as unknown as CanvasMessage

        switch (canvasMsg.type) {
          case "ready":
            onReady?.()
            break
          case "selected":
            handleResolve({ success: true, data: canvasMsg.data as TResult })
            break
          case "cancelled":
            handleResolve({ success: true, cancelled: true })
            break
          case "error":
            handleResolve({ success: false, error: canvasMsg.message })
            break
        }
      },
      onClientDisconnect() {
        if (!resolved) {
          handleResolve({ success: false, error: "Canvas disconnected" })
        }
      },
    }).then((s) => {
      server = s
    })

    timeoutId = setTimeout(() => {
      handleResolve({ success: false, error: "Timeout" })
    }, timeout)

    spawnCanvas(kind, id, JSON.stringify(config), { socketPath, scenario }).catch((err) => {
      handleResolve({ success: false, error: err.message })
    })
  })
}

export interface MeetingPickerConfig extends CalendarConfig {
  title?: string
}

export interface MeetingPickerResult {
  date: string
  startTime: string
  endTime: string
}

export async function pickMeetingTime(
  config: MeetingPickerConfig,
  options?: SpawnOptions
): Promise<CanvasResult<MeetingPickerResult>> {
  return spawnCanvasWithIPC<MeetingPickerConfig, MeetingPickerResult>("calendar", "meeting-picker", config, options)
}

export interface EditDocumentConfig extends DocumentConfig {
  title?: string
}

export async function editDocument(
  config: EditDocumentConfig,
  options?: SpawnOptions
): Promise<CanvasResult<DocumentSelection>> {
  return spawnCanvasWithIPC<EditDocumentConfig, DocumentSelection>("document", "edit", config, options)
}

export interface ViewDocumentConfig extends DocumentConfig {
  title?: string
}

export async function viewDocument(config: ViewDocumentConfig, options?: SpawnOptions): Promise<CanvasResult<void>> {
  return spawnCanvasWithIPC<ViewDocumentConfig, void>("document", "display", config, options)
}

export interface BookFlightConfig extends FlightConfig {
  title?: string
}

export async function bookFlight(config: BookFlightConfig, options?: SpawnOptions): Promise<CanvasResult<Flight>> {
  return spawnCanvasWithIPC<BookFlightConfig, Flight>("flight", "booking", config, options)
}

export async function connectToCanvas(socketPath: string): Promise<IPCClient> {
  return createIPCClient({
    socketPath,
    onMessage: () => {},
  })
}
