# OpenCode Canvas - Implementation Plan

**Project**: Port claude-canvas to OpenCode using SolidJS/OpenTUI
**Estimated Effort**: 8-10 days (64-80 hours)
**Risk Level**: Low - mechanical port, same paradigm

---

## Executive Summary

Port [dvdsgl/claude-canvas](https://github.com/dvdsgl/claude-canvas) from React/Ink to SolidJS/OpenTUI for native OpenCode integration. The original uses React hooks and Ink components; we'll translate to SolidJS signals and OpenTUI primitives.

### Key Insight

OpenCode already uses `@opentui/solid` for its TUI. This is the **same framework** we'll use, making this a straightforward translation rather than a rewrite.

---

## Phase 1: Project Setup (Day 1)

### 1.1 Initialize Package

```bash
cd /Users/davidhelmus/Repos/opencode-canvas
bun init
```

**package.json:**

```json
{
  "name": "opencode-canvas",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "canvas": "src/cli.ts"
  },
  "scripts": {
    "dev": "bun run src/cli.ts",
    "typecheck": "bunx tsc --noEmit",
    "test": "bun test",
    "build": "bun build src/cli.ts --outdir dist --target bun"
  },
  "dependencies": {
    "@opentui/core": "0.1.72",
    "@opentui/solid": "0.1.72",
    "commander": "^14.0.0",
    "solid-js": "1.9.9"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5"
  }
}
```

**tsconfig.json:**

```json
{
  "extends": "@tsconfig/bun/tsconfig.json",
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@opentui/solid",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**bunfig.toml:**

```toml
preload = ["@opentui/solid/preload"]
```

### 1.2 Create Directory Structure

```
src/
├── cli.ts
├── terminal.ts
├── canvases/
│   ├── index.tsx
│   ├── calendar.tsx
│   ├── calendar/
│   │   ├── types.ts
│   │   ├── hooks/
│   │   │   └── use-ipc-server.ts
│   │   └── scenarios/
│   │       └── meeting-picker.tsx
│   ├── document.tsx
│   ├── document/
│   │   ├── types.ts
│   │   └── components/
│   │       ├── markdown-renderer.tsx
│   │       └── email-header.tsx
│   └── flight.tsx
├── ipc/
│   ├── index.ts
│   ├── types.ts
│   ├── server.ts
│   └── client.ts
└── api/
    ├── index.ts
    └── canvas-api.ts
skills/
├── canvas/SKILL.md
├── calendar/SKILL.md
├── document/SKILL.md
└── flight/SKILL.md
```

### Deliverables

- [ ] package.json with correct dependencies
- [ ] tsconfig.json with OpenTUI JSX config
- [ ] bunfig.toml with preload
- [ ] Directory structure created
- [ ] `bun install` succeeds

---

## Phase 2: IPC System (Day 2)

### 2.1 IPC Types (`src/ipc/types.ts`)

Direct port - no changes needed:

```typescript
// Messages from Controller to Canvas
export type ControllerMessage =
  | { type: "close" }
  | { type: "update"; config: unknown }
  | { type: "ping" }
  | { type: "getSelection" }
  | { type: "getContent" }

// Messages from Canvas to Controller
export type CanvasMessage =
  | { type: "ready"; scenario: string }
  | { type: "selected"; data: unknown }
  | { type: "cancelled"; reason?: string }
  | { type: "error"; message: string }
  | { type: "pong" }
  | { type: "selection"; data: SelectionData | null }
  | { type: "content"; data: ContentData }

export interface SelectionData {
  selectedText: string
  startOffset: number
  endOffset: number
}

export interface ContentData {
  content: string
  cursorPosition: number
}

export function getSocketPath(id: string): string {
  return `/tmp/canvas-${id}.sock`
}
```

### 2.2 IPC Server (`src/ipc/server.ts`)

Direct port - uses Bun.listen (already Bun-native):

```typescript
import { unlinkSync, existsSync } from "fs"
import type { ControllerMessage, CanvasMessage } from "./types"

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

  const clients = new Set<any>()
  let buffer = ""

  const server = Bun.listen({
    unix: socketPath,
    socket: {
      open(socket) {
        clients.add(socket)
        onClientConnect?.()
      },
      data(socket, data) {
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
      error(socket, error) {
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
```

### 2.3 IPC Client (`src/ipc/client.ts`)

Direct port - uses Bun.connect (already Bun-native).

### 2.4 Tests

```typescript
// src/ipc/server.test.ts
import { describe, test, expect, afterEach } from "bun:test"
import { createIPCServer } from "./server"
import { getSocketPath } from "./types"

describe("IPC Server", () => {
  const testId = "test-canvas"
  const socketPath = getSocketPath(testId)

  afterEach(async () => {
    // Cleanup
  })

  test("creates socket file", async () => {
    const server = await createIPCServer({
      socketPath,
      onMessage: () => {},
    })
    expect(Bun.file(socketPath).size).toBeGreaterThan(0)
    server.close()
  })
})
```

### Deliverables

- [ ] `src/ipc/types.ts` - Message types
- [ ] `src/ipc/server.ts` - Unix socket server
- [ ] `src/ipc/client.ts` - Unix socket client
- [ ] `src/ipc/index.ts` - Exports
- [ ] `src/ipc/server.test.ts` - Server tests
- [ ] All tests pass

---

## Phase 3: Terminal Spawning (Day 2-3)

### 3.1 Terminal Detection (`src/terminal.ts`)

```typescript
import { spawn, spawnSync } from "child_process"

export interface TerminalEnvironment {
  inTmux: boolean
  summary: string
}

export function detectTerminal(): TerminalEnvironment {
  const inTmux = !!process.env.TMUX
  return { inTmux, summary: inTmux ? "tmux" : "no tmux" }
}

const CANVAS_PANE_FILE = "/tmp/opencode-canvas-pane-id"

export async function spawnCanvas(
  kind: string,
  id: string,
  configJson?: string,
  options?: { socketPath?: string; scenario?: string }
): Promise<{ method: string }> {
  const env = detectTerminal()

  if (!env.inTmux) {
    throw new Error("Canvas requires tmux. Please run inside a tmux session.")
  }

  const socketPath = options?.socketPath || `/tmp/canvas-${id}.sock`

  // Build command
  let command = `bun run ${import.meta.dir}/cli.ts show ${kind} --id ${id}`
  if (configJson) {
    const configFile = `/tmp/canvas-config-${id}.json`
    await Bun.write(configFile, configJson)
    command += ` --config "$(cat ${configFile})"`
  }
  command += ` --socket ${socketPath}`
  if (options?.scenario) {
    command += ` --scenario ${options.scenario}`
  }

  // Check for existing pane to reuse
  const existingPaneId = await getCanvasPaneId()
  if (existingPaneId) {
    const reused = await reuseExistingPane(existingPaneId, command)
    if (reused) return { method: "tmux-reuse" }
  }

  // Create new split pane
  const created = await createNewPane(command)
  if (created) return { method: "tmux-split" }

  throw new Error("Failed to spawn tmux pane")
}

async function getCanvasPaneId(): Promise<string | null> {
  try {
    const file = Bun.file(CANVAS_PANE_FILE)
    if (await file.exists()) {
      const paneId = (await file.text()).trim()
      const result = spawnSync("tmux", ["display-message", "-t", paneId, "-p", "#{pane_id}"])
      if (result.status === 0 && result.stdout?.toString().trim() === paneId) {
        return paneId
      }
    }
  } catch {}
  return null
}

async function saveCanvasPaneId(paneId: string): Promise<void> {
  await Bun.write(CANVAS_PANE_FILE, paneId)
}

async function createNewPane(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const args = ["split-window", "-h", "-p", "67", "-P", "-F", "#{pane_id}", command]
    const proc = spawn("tmux", args)
    let paneId = ""
    proc.stdout?.on("data", (data) => {
      paneId += data.toString()
    })
    proc.on("close", async (code) => {
      if (code === 0 && paneId.trim()) {
        await saveCanvasPaneId(paneId.trim())
      }
      resolve(code === 0)
    })
    proc.on("error", () => resolve(false))
  })
}

async function reuseExistingPane(paneId: string, command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const killProc = spawn("tmux", ["send-keys", "-t", paneId, "C-c"])
    killProc.on("close", () => {
      setTimeout(() => {
        const args = ["send-keys", "-t", paneId, `clear && ${command}`, "Enter"]
        const proc = spawn("tmux", args)
        proc.on("close", (code) => resolve(code === 0))
        proc.on("error", () => resolve(false))
      }, 150)
    })
    killProc.on("error", () => resolve(false))
  })
}
```

### Deliverables

- [ ] `src/terminal.ts` - tmux detection and spawning
- [ ] Pane reuse logic working
- [ ] Manual test: `bun run src/cli.ts spawn calendar` opens split pane

---

## Phase 4: CLI Entry Point (Day 3)

### 4.1 CLI (`src/cli.ts`)

```typescript
#!/usr/bin/env bun
import { program } from "commander"
import { detectTerminal, spawnCanvas } from "./terminal"

function setWindowTitle(title: string) {
  process.stdout.write(`\x1b]0;${title}\x07`)
}

program.name("opencode-canvas").description("Interactive terminal canvases for OpenCode").version("0.1.0")

program
  .command("show [kind]")
  .description("Show a canvas in the current terminal")
  .option("--id <id>", "Canvas ID")
  .option("--config <json>", "Canvas configuration (JSON)")
  .option("--socket <path>", "Unix socket path for IPC")
  .option("--scenario <name>", "Scenario name")
  .action(async (kind = "calendar", options) => {
    const id = options.id || `${kind}-1`
    const config = options.config ? JSON.parse(options.config) : undefined
    setWindowTitle(`canvas: ${kind}`)

    const { renderCanvas } = await import("./canvases")
    await renderCanvas(kind, id, config, {
      socketPath: options.socket,
      scenario: options.scenario || "display",
    })
  })

program
  .command("spawn [kind]")
  .description("Spawn a canvas in a new tmux split")
  .option("--id <id>", "Canvas ID")
  .option("--config <json>", "Canvas configuration (JSON)")
  .option("--socket <path>", "Unix socket path for IPC")
  .option("--scenario <name>", "Scenario name")
  .action(async (kind = "calendar", options) => {
    const id = options.id || `${kind}-1`
    const result = await spawnCanvas(kind, id, options.config, {
      socketPath: options.socket,
      scenario: options.scenario,
    })
    console.log(`Spawned ${kind} canvas '${id}' via ${result.method}`)
  })

program
  .command("env")
  .description("Show detected terminal environment")
  .action(() => {
    const env = detectTerminal()
    console.log(`In tmux: ${env.inTmux}`)
  })

program.parse()
```

### Deliverables

- [ ] `src/cli.ts` - Full CLI with show/spawn/env commands
- [ ] `bun run src/cli.ts --help` works
- [ ] `bun run src/cli.ts env` shows tmux status

---

## Phase 5: Canvas Components (Days 4-7)

### 5.1 Canvas Registry (`src/canvases/index.tsx`)

```tsx
import { render } from "@opentui/solid"
import { Calendar } from "./calendar"
import { Document } from "./document"
import { FlightCanvas } from "./flight"
import type { CalendarConfig } from "./calendar/types"
import type { DocumentConfig } from "./document/types"
import type { FlightConfig } from "./flight/types"

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H\x1b[?25l")
}

function showCursor() {
  process.stdout.write("\x1b[?25h")
}

export interface RenderOptions {
  socketPath?: string
  scenario?: string
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

async function renderCalendar(id: string, config?: CalendarConfig, options?: RenderOptions) {
  const { waitUntilExit } = render(() => (
    <Calendar id={id} config={config} socketPath={options?.socketPath} scenario={options?.scenario || "display"} />
  ))
  await waitUntilExit()
}

// Similar for document and flight...
```

### 5.2 Translation Pattern (React/Ink -> SolidJS/OpenTUI)

**Original React/Ink:**

```tsx
import React, { useState, useEffect } from "react"
import { Box, Text, useInput, useApp, useStdout } from "ink"

function Calendar({ config }) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const [selected, setSelected] = useState(0)
  const [dimensions, setDimensions] = useState({ width: 120, height: 40 })

  useEffect(() => {
    const update = () => setDimensions({ width: stdout.columns, height: stdout.rows })
    stdout.on("resize", update)
    return () => stdout.off("resize", update)
  }, [stdout])

  useInput((input, key) => {
    if (input === "q") exit()
    if (key.downArrow) setSelected((s) => s + 1)
  })

  return (
    <Box flexDirection="column">
      <Text bold>Calendar</Text>
    </Box>
  )
}
```

**Translated SolidJS/OpenTUI:**

```tsx
import { createSignal, createEffect, onCleanup } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"

function Calendar(props: { config?: CalendarConfig }) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const [selected, setSelected] = createSignal(0)

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") renderer.exit()
    if (key.name === "down") setSelected((s) => s + 1)
  })

  return (
    <box flexDirection="column">
      <text bold>Calendar</text>
    </box>
  )
}
```

### 5.3 Component Porting Checklist

#### Calendar Canvas (`src/canvases/calendar.tsx`)

- [ ] Port main Calendar component
- [ ] Port DayColumn component
- [ ] Port DayHeadersRow component
- [ ] Port AllDayEventsRow component
- [ ] Port time slot rendering
- [ ] Port keyboard navigation (←/→ week, t today, q quit)
- [ ] Port current time indicator
- [ ] Port event rendering with colors

#### Calendar Hooks (`src/canvases/calendar/hooks/`)

- [ ] Port `use-ipc-server.ts` to SolidJS (createSignal, onCleanup)
- [ ] Port `use-mouse.ts` if needed

#### Calendar Scenarios (`src/canvases/calendar/scenarios/`)

- [ ] Port `meeting-picker-view.tsx`

#### Document Canvas (`src/canvases/document.tsx`)

- [ ] Port main Document component
- [ ] Port scroll handling
- [ ] Port cursor/selection state
- [ ] Port keyboard navigation
- [ ] Port IPC integration (getSelection, getContent)

#### Document Components (`src/canvases/document/components/`)

- [ ] Port `raw-markdown-renderer.tsx`
- [ ] Port `email-header.tsx`
- [ ] Port `markdown-renderer.tsx`

#### Flight Canvas (`src/canvases/flight.tsx`)

- [ ] Port main FlightCanvas component
- [ ] Port flight comparison view
- [ ] Port seat selection view

### 5.4 Shared Hook: useIPCServer (SolidJS version)

```tsx
// src/canvases/calendar/hooks/use-ipc-server.ts
import { createSignal, onMount, onCleanup } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { createIPCServer, type IPCServer } from "@/ipc/server"
import type { ControllerMessage } from "@/ipc/types"

export interface UseIPCServerOptions {
  socketPath: string | undefined
  scenario: string
  onClose?: () => void
  onUpdate?: (config: unknown) => void
  onGetSelection?: () => { selectedText: string; startOffset: number; endOffset: number } | null
  onGetContent?: () => { content: string; cursorPosition: number }
}

export function useIPCServer(options: UseIPCServerOptions) {
  const renderer = useRenderer()
  const [isConnected, setIsConnected] = createSignal(false)
  let server: IPCServer | null = null

  onMount(async () => {
    if (!options.socketPath) return

    server = await createIPCServer({
      socketPath: options.socketPath,
      onMessage: (msg: ControllerMessage) => {
        switch (msg.type) {
          case "close":
            options.onClose?.()
            renderer.exit()
            break
          case "update":
            options.onUpdate?.(msg.config)
            break
          case "ping":
            server?.broadcast({ type: "pong" })
            break
          case "getSelection":
            const selection = options.onGetSelection?.() || null
            server?.broadcast({ type: "selection", data: selection })
            break
          case "getContent":
            const content = options.onGetContent?.()
            if (content) server?.broadcast({ type: "content", data: content })
            break
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
```

### Deliverables

- [ ] `src/canvases/index.tsx` - Canvas registry
- [ ] `src/canvases/calendar.tsx` - Full calendar port
- [ ] `src/canvases/calendar/hooks/use-ipc-server.ts` - IPC hook
- [ ] `src/canvases/document.tsx` - Full document port
- [ ] `src/canvases/flight.tsx` - Full flight port
- [ ] All canvases render correctly
- [ ] Keyboard navigation works
- [ ] IPC communication works

---

## Phase 6: High-Level API (Day 8)

### 6.1 Canvas API (`src/api/canvas-api.ts`)

Port the high-level API for programmatic canvas spawning:

```typescript
import { createIPCServer } from "@/ipc/server"
import { getSocketPath } from "@/ipc/types"
import { spawnCanvas } from "@/terminal"
import type { CanvasMessage } from "@/ipc/types"

export interface CanvasResult<T = unknown> {
  success: boolean
  data?: T
  cancelled?: boolean
  error?: string
}

export async function spawnCanvasWithIPC<TConfig, TResult>(
  kind: string,
  scenario: string,
  config: TConfig,
  options: { timeout?: number; onReady?: () => void } = {}
): Promise<CanvasResult<TResult>> {
  const { timeout = 300000, onReady } = options
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const socketPath = getSocketPath(id)

  return new Promise((resolve) => {
    let resolved = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let server: Awaited<ReturnType<typeof createIPCServer>> | null = null

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      server?.close()
    }

    createIPCServer({
      socketPath,
      onMessage(msg: CanvasMessage) {
        if (resolved) return

        switch (msg.type) {
          case "ready":
            onReady?.()
            break
          case "selected":
            resolved = true
            cleanup()
            resolve({ success: true, data: msg.data as TResult })
            break
          case "cancelled":
            resolved = true
            cleanup()
            resolve({ success: true, cancelled: true })
            break
          case "error":
            resolved = true
            cleanup()
            resolve({ success: false, error: msg.message })
            break
        }
      },
      onClientDisconnect() {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve({ success: false, error: "Canvas disconnected" })
        }
      },
    }).then((s) => {
      server = s
    })

    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve({ success: false, error: "Timeout" })
      }
    }, timeout)

    spawnCanvas(kind, id, JSON.stringify(config), { socketPath, scenario }).catch((err) => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve({ success: false, error: err.message })
      }
    })
  })
}

// Convenience functions
export async function pickMeetingTime(config: MeetingPickerConfig) {
  return spawnCanvasWithIPC("calendar", "meeting-picker", config)
}

export async function editDocument(config: DocumentConfig) {
  return spawnCanvasWithIPC("document", "edit", config)
}
```

### Deliverables

- [ ] `src/api/canvas-api.ts` - High-level API
- [ ] `src/api/index.ts` - Exports
- [ ] API tests pass

---

## Phase 7: Skills Integration (Day 9)

### 7.1 Main Canvas Skill (`skills/canvas/SKILL.md`)

```markdown
---
name: canvas
description: |
  Terminal TUI toolkit for interactive canvases. Spawn calendars, documents, 
  or flight booking interfaces in tmux split panes.
---

# Canvas TUI Toolkit

## Quick Start

\`\`\`bash

# Show canvas in current terminal

bun run src/cli.ts show calendar

# Spawn in tmux split (interactive)

bun run src/cli.ts spawn calendar --scenario meeting-picker --config '{...}'
\`\`\`

## Canvas Types

| Canvas   | Scenarios                    | Purpose                            |
| -------- | ---------------------------- | ---------------------------------- |
| calendar | display, meeting-picker      | Show calendars, pick meeting times |
| document | display, edit, email-preview | View/edit markdown                 |
| flight   | booking                      | Compare flights, select seats      |

## IPC Protocol

Canvas communicates via Unix sockets at `/tmp/canvas-{id}.sock`

**Canvas -> Controller:** ready, selected, cancelled, error
**Controller -> Canvas:** update, close, ping, getSelection, getContent

## API Usage

\`\`\`typescript
import { pickMeetingTime, editDocument } from "./src/api"

const result = await pickMeetingTime({
calendars: [...],
slotGranularity: 30,
})

if (result.success && result.data) {
console.log(\`Selected: \${result.data.startTime}\`)
}
\`\`\`
```

### 7.2 Calendar Skill (`skills/calendar/SKILL.md`)

### 7.3 Document Skill (`skills/document/SKILL.md`)

### 7.4 Flight Skill (`skills/flight/SKILL.md`)

### Deliverables

- [ ] `skills/canvas/SKILL.md`
- [ ] `skills/calendar/SKILL.md`
- [ ] `skills/document/SKILL.md`
- [ ] `skills/flight/SKILL.md`
- [ ] Skills discoverable by OpenCode

---

## Phase 8: Testing & Polish (Day 10)

### 8.1 Test Coverage

```
src/
├── ipc/
│   ├── server.test.ts      # Socket server tests
│   └── client.test.ts      # Socket client tests
├── terminal.test.ts        # tmux detection tests
└── canvases/
    ├── calendar.test.ts    # Calendar rendering tests
    └── document.test.ts    # Document rendering tests
```

### 8.2 Manual Testing Checklist

- [ ] `bun run src/cli.ts show calendar` - renders calendar
- [ ] `bun run src/cli.ts spawn calendar` - opens tmux split
- [ ] Calendar keyboard nav: ←/→ changes week, t goes to today, q quits
- [ ] `bun run src/cli.ts show document --config '{"content":"# Hello"}'`
- [ ] Document scroll works
- [ ] IPC: spawn canvas, send update, receive selection
- [ ] Pane reuse: spawn twice, second reuses existing pane
- [ ] Cleanup: sockets removed on exit

### 8.3 Documentation

- [ ] Update AGENTS.md with final commands
- [ ] README.md with usage examples
- [ ] Inline code comments

### Deliverables

- [ ] All tests pass
- [ ] Manual testing complete
- [ ] Documentation updated

---

## Risk Mitigation

| Risk                       | Mitigation                              |
| -------------------------- | --------------------------------------- |
| OpenTUI API differences    | Reference OpenCode TUI code extensively |
| Mouse handling complexity  | Defer mouse support to v2 if needed     |
| Complex markdown rendering | Use OpenTUI's built-in Code component   |
| tmux edge cases            | Graceful error messages, require tmux   |

---

## Success Criteria

1. **Functional**: All three canvases (calendar, document, flight) render and respond to keyboard
2. **IPC Working**: Controller can spawn canvas, receive selections, send updates
3. **Integration Ready**: Skills work with OpenCode's skill system
4. **Tests Pass**: `bun test` succeeds
5. **Documentation**: AGENTS.md and skills complete

---

## File Count Estimate

| Category  | Files   | Lines (est.) |
| --------- | ------- | ------------ |
| IPC       | 4       | ~200         |
| Terminal  | 1       | ~100         |
| CLI       | 1       | ~100         |
| Canvases  | 10      | ~1500        |
| API       | 2       | ~150         |
| Skills    | 4       | ~300         |
| Tests     | 5       | ~300         |
| Config    | 4       | ~50          |
| **Total** | **~31** | **~2700**    |

---

## Next Steps

1. Run `/implement phase-1` to start project setup
2. Proceed phase by phase, testing each before moving on
3. Consult Oracle if architectural questions arise
