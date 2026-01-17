import { createSignal, onMount, onCleanup } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { createIPCServer, type IPCServer } from "@/ipc/server"
import { isControllerMessage } from "@/ipc/types"

export interface UseIPCServerOptions {
  socketPath: string | undefined
  scenario: string
  onClose?: () => void
  onUpdate?: (config: unknown) => void
  onGetSelection?: () => { selectedText: string; startOffset: number; endOffset: number } | null
  onGetContent?: () => { content: string; cursorPosition: number }
}

export interface IPCServerHandle {
  isConnected: () => boolean
  sendReady: () => void
  sendSelected: (data: unknown) => void
  sendCancelled: (reason?: string) => void
  sendError: (message: string) => void
}

export function useIPCServer(options: UseIPCServerOptions): IPCServerHandle {
  const renderer = useRenderer()
  const [isConnected, setIsConnected] = createSignal(false)
  let server: IPCServer | null = null

  onMount(async () => {
    if (!options.socketPath) return

    server = await createIPCServer({
      socketPath: options.socketPath,
      onMessage: (msg) => {
        if (!isControllerMessage(msg)) {
          console.error("Invalid controller message format:", msg)
          return
        }

        switch (msg.type) {
          case "close":
            options.onClose?.()
            renderer.destroy()
            break
          case "update":
            options.onUpdate?.(msg.config)
            break
          case "ping":
            server?.broadcast({ type: "pong" })
            break
          case "getSelection": {
            const selection = options.onGetSelection?.() || null
            server?.broadcast({ type: "selection", data: selection })
            break
          }
          case "getContent": {
            const content = options.onGetContent?.()
            if (content) server?.broadcast({ type: "content", data: content })
            break
          }
        }
      },
      onClientConnect: () => setIsConnected(true),
      onClientDisconnect: () => setIsConnected(false),
    })
  })

  onCleanup(() => {
    server?.close()
  })

  return {
    isConnected,
    sendReady: () => server?.broadcast({ type: "ready", scenario: options.scenario }),
    sendSelected: (data: unknown) => server?.broadcast({ type: "selected", data }),
    sendCancelled: (reason?: string) => server?.broadcast({ type: "cancelled", reason }),
    sendError: (message: string) => server?.broadcast({ type: "error", message }),
  }
}
