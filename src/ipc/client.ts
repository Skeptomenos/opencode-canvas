import type { ControllerMessage, CanvasMessage } from "./types"
import type { Socket } from "bun"

export interface IPCClientOptions {
  socketPath: string
  onMessage: (msg: CanvasMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

export interface IPCClient {
  send: (msg: ControllerMessage) => void
  close: () => void
  isConnected: () => boolean
}

export async function createIPCClient(options: IPCClientOptions): Promise<IPCClient> {
  const { socketPath, onMessage, onConnect, onDisconnect, onError } = options

  const state = { buffer: "", connected: false }

  const socket = await Bun.connect({
    unix: socketPath,
    socket: {
      open() {
        state.connected = true
        onConnect?.()
      },
      data(_socket, data) {
        state.buffer += data.toString()
        const lines = state.buffer.split("\n")
        state.buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line) as CanvasMessage
              onMessage(msg)
            } catch (e) {
              onError?.(new Error(`Failed to parse: ${line}`))
            }
          }
        }
      },
      close() {
        state.connected = false
        onDisconnect?.()
      },
      error(_socket, error) {
        onError?.(error)
      },
    },
  })

  return {
    send(msg: ControllerMessage) {
      if (socket && state.connected) {
        socket.write(JSON.stringify(msg) + "\n")
      }
    },
    close() {
      socket?.end()
      state.connected = false
    },
    isConnected() {
      return state.connected
    },
  }
}
