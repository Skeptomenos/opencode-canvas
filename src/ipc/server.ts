import { unlinkSync, existsSync } from "fs"
import type { ControllerMessage, CanvasMessage } from "./types"
import type { Socket } from "bun"

export interface IPCServerOptions {
  socketPath: string
  onMessage: (msg: ControllerMessage) => void
  onClientConnect?: () => void
  onClientDisconnect?: () => void
  onError?: (error: Error) => void
}

export interface IPCServer {
  broadcast: (msg: CanvasMessage) => void
  close: () => void
}

export async function createIPCServer(options: IPCServerOptions): Promise<IPCServer> {
  const { socketPath, onMessage, onClientConnect, onClientDisconnect, onError } = options

  if (existsSync(socketPath)) {
    unlinkSync(socketPath)
  }

  const clients = new Set<Socket<unknown>>()
  let buffer = ""

  const server = Bun.listen({
    unix: socketPath,
    socket: {
      open(socket) {
        clients.add(socket)
        onClientConnect?.()
      },
      data(_socket, data) {
        buffer += data.toString()
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line) as ControllerMessage
              onMessage(msg)
            } catch (e) {
              onError?.(new Error(`Failed to parse: ${line}`))
            }
          }
        }
      },
      close(socket) {
        clients.delete(socket)
        onClientDisconnect?.()
      },
      error(_socket, error) {
        onError?.(error)
      },
    },
  })

  return {
    broadcast(msg: CanvasMessage) {
      const data = JSON.stringify(msg) + "\n"
      for (const client of clients) {
        client.write(data)
      }
    },
    close() {
      server.stop()
      if (existsSync(socketPath)) {
        unlinkSync(socketPath)
      }
    },
  }
}
