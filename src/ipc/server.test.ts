import { describe, test, expect, afterEach } from "bun:test"
import { createIPCServer } from "./server"
import { createIPCClient } from "./client"
import { getSocketPath } from "./types"
import { existsSync, unlinkSync } from "fs"

describe("IPC Server", () => {
  const testId = `test-${Date.now()}`
  const socketPath = getSocketPath(testId)

  afterEach(() => {
    if (existsSync(socketPath)) {
      unlinkSync(socketPath)
    }
  })

  test("creates and removes socket file", async () => {
    const server = await createIPCServer({
      socketPath,
      onMessage: () => {},
    })

    expect(existsSync(socketPath)).toBe(true)

    server.close()

    expect(existsSync(socketPath)).toBe(false)
  })

  test("receives messages from client", async () => {
    const received: unknown[] = []

    const server = await createIPCServer({
      socketPath,
      onMessage: (msg) => received.push(msg),
    })

    const client = await createIPCClient({
      socketPath,
      onMessage: () => {},
    })

    await new Promise((r) => setTimeout(r, 50))

    client.send({ type: "ping" })

    await new Promise((r) => setTimeout(r, 50))

    expect(received).toContainEqual({ type: "ping" })

    client.close()
    server.close()
  })

  test("broadcasts messages to client", async () => {
    const received: unknown[] = []

    const server = await createIPCServer({
      socketPath,
      onMessage: () => {},
    })

    const client = await createIPCClient({
      socketPath,
      onMessage: (msg) => received.push(msg),
    })

    await new Promise((r) => setTimeout(r, 50))

    server.broadcast({ type: "ready", scenario: "test" })

    await new Promise((r) => setTimeout(r, 50))

    expect(received).toContainEqual({ type: "ready", scenario: "test" })

    client.close()
    server.close()
  })

  test("notifies on client connect/disconnect", async () => {
    let connected = false
    let disconnected = false

    const server = await createIPCServer({
      socketPath,
      onMessage: () => {},
      onClientConnect: () => {
        connected = true
      },
      onClientDisconnect: () => {
        disconnected = true
      },
    })

    const client = await createIPCClient({
      socketPath,
      onMessage: () => {},
    })

    await new Promise((r) => setTimeout(r, 50))
    expect(connected).toBe(true)

    client.close()

    await new Promise((r) => setTimeout(r, 50))
    expect(disconnected).toBe(true)

    server.close()
  })
})

describe("IPC Client", () => {
  const testId = `test-client-${Date.now()}`
  const socketPath = getSocketPath(testId)

  afterEach(() => {
    if (existsSync(socketPath)) {
      unlinkSync(socketPath)
    }
  })

  test("reports connection status", async () => {
    const server = await createIPCServer({
      socketPath,
      onMessage: () => {},
    })

    const client = await createIPCClient({
      socketPath,
      onMessage: () => {},
    })

    await new Promise((r) => setTimeout(r, 50))
    expect(client.isConnected()).toBe(true)

    client.close()
    expect(client.isConnected()).toBe(false)

    server.close()
  })
})

describe("getSocketPath", () => {
  test("returns correct path format", () => {
    expect(getSocketPath("my-canvas")).toBe("/tmp/canvas-my-canvas.sock")
    expect(getSocketPath("calendar-1")).toBe("/tmp/canvas-calendar-1.sock")
  })
})
