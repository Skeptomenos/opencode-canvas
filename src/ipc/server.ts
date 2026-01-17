import { unlinkSync, existsSync } from "fs"
import type { CanvasMessage } from "./types"
import type { Socket } from "bun"

export interface IPCServerOptions {
  socketPath: string
  onMessage: (msg: unknown) => void
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

  // Clean up stale socket from previous process (handles SIGKILL/crash scenarios)
  if (existsSync(socketPath)) {
    unlinkSync(socketPath)
  }

  const clients = new Set<Socket<unknown>>()
  const socketBuffers = new Map<Socket<unknown>, string>()

  const server = Bun.listen({
    unix: socketPath,
    socket: {
      open(socket) {
        clients.add(socket)
        socketBuffers.set(socket, "")
        onClientConnect?.()
      },
      data(socket, data) {
        const currentBuffer = socketBuffers.get(socket) || ""
        const newBuffer = currentBuffer + data.toString()
        const lines = newBuffer.split("\n")
        const remainingBuffer = lines.pop() || ""
        socketBuffers.set(socket, remainingBuffer)

        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg: unknown = JSON.parse(line)
              onMessage(msg)
            } catch (e) {
              onError?.(new Error(`Failed to parse: ${line}`))
            }
          }
        }
      },
      close(socket) {
        clients.delete(socket)
        socketBuffers.delete(socket)
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
