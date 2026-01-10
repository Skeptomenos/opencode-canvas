# OpenCode Canvas - Limitations & Mitigation Plan

**Purpose**: Proactive identification and prevention of known risks during implementation.

**Structure**:

- Risk severity levels (CRITICAL, HIGH, MEDIUM, LOW)
- Specific mitigation steps per risk
- Prevention checklist
- Testing strategy
- Fallback procedures

---

## Risk Categories

1. **Architecture & Design** (missing details, unclear patterns)
2. **Configuration & Setup** (tooling, version management)
3. **IPC & Lifecycle** (socket cleanup, signal handling)
4. **Testing & Validation** (insufficient test coverage)
5. **OpenTUI API** (unfamiliar framework, undocumented behavior)
6. **Terminal/tmux** (platform-specific, edge cases)

---

# CRITICAL RISKS

## C1: Pane Reuse Race Condition

**Risk**: Terminal spawning uses `/tmp/opencode-canvas-pane-id` file to track panes. Concurrent spawns can:

- Read stale pane ID (process exited)
- Both write simultaneously → corrupted file
- Reuse pane with wrong command still running

**Location**: `src/terminal.ts` → `getCanvasPaneId()`, `reuseExistingPane()`

**Mitigation Steps**:

1. **Add pane validation before reuse**:

```typescript
async function getCanvasPaneId(): Promise<string | null> {
  try {
    const file = Bun.file(CANVAS_PANE_FILE)
    if (await file.exists()) {
      const paneId = (await file.text()).trim()

      // Validate pane still exists
      const result = spawnSync("tmux", ["display-message", "-t", paneId, "-p", "#{pane_id}"])

      if (result.status === 0) {
        const actualId = result.stdout?.toString().trim()
        if (actualId === paneId) {
          // Pane exists and ID matches - safe to reuse
          return paneId
        }
      }
    }
  } catch {}

  // Delete stale file
  try {
    await Bun.file(CANVAS_PANE_FILE).delete()
  } catch {}

  return null
}
```

2. **Add atomic file locking (mutex)**:

```typescript
import { lock, unlock } from "proper-lockfile"

const LOCK_FILE = CANVAS_PANE_FILE + ".lock"

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  let lockPath: string | undefined
  try {
    lockPath = await lock(LOCK_FILE, { stale: 5000 }) // 5s timeout
    return await fn()
  } finally {
    if (lockPath) await unlock(lockPath)
  }
}

// Usage:
const paneId = await withLock(async () => {
  return await getCanvasPaneId()
})
```

3. **Fallback to new pane on reuse failure**:

```typescript
async function spawnCanvas(...): Promise<{ method: string }> {
  const existingPaneId = await getCanvasPaneId()
  if (existingPaneId) {
    try {
      const reused = await reuseExistingPane(existingPaneId, command)
      if (reused) return { method: "tmux-reuse" }
    } catch (error) {
      console.warn(`Reuse failed: ${error.message}, creating new pane`)
      // Fall through to create new pane
    }
  }

  const created = await createNewPane(command)
  if (created) return { method: "tmux-split" }
  throw new Error("Failed to spawn canvas in any mode")
}
```

4. **Add timeout to pane process**:

```typescript
async function reuseExistingPane(paneId: string, command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const killProc = spawn("tmux", ["send-keys", "-t", paneId, "C-c"])

    const timeout = setTimeout(() => {
      killProc.kill()
      resolve(false) // Timeout = reuse failed
    }, 2000)

    killProc.on("close", () => {
      clearTimeout(timeout)
      setTimeout(() => {
        const args = ["send-keys", "-t", paneId, `clear && ${command}`, "Enter"]
        const proc = spawn("tmux", args)
        proc.on("close", (code) => resolve(code === 0))
        proc.on("error", () => resolve(false))
      }, 150)
    })
    killProc.on("error", () => {
      clearTimeout(timeout)
      resolve(false)
    })
  })
}
```

**Prevention Checklist**:

- [ ] Add pane validation check (tmux display-message)
- [ ] Implement lockfile mechanism
- [ ] Test concurrent spawns (run `spawn canvas` twice rapidly)
- [ ] Verify stale pane IDs are cleaned up
- [ ] Test fallback to new pane on reuse failure
- [ ] Document tmux requirement in README

**Severity**: CRITICAL  
**Impact**: Process hangs, socket conflicts, UI freeze  
**Effort**: 2-3 hours

---

## C2: Socket Cleanup on Abnormal Exit

**Risk**: IPC server holds Unix socket open. If canvas exits via:

- SIGKILL (kill -9)
- Panic/crash
- Parent process killed
- Tmux pane closed

Socket remains at `/tmp/canvas-{id}.sock`, preventing restart. Next spawn fails with "Address already in use".

**Location**: `src/ipc/server.ts`, `src/canvases/*.tsx`

**Mitigation Steps**:

1. **Aggressive socket cleanup on startup**:

```typescript
export async function createIPCServer(options: IPCServerOptions): Promise<IPCServer> {
  const { socketPath, onMessage, onClientConnect, onClientDisconnect, onError } = options

  // Clean up any existing socket file
  if (existsSync(socketPath)) {
    try {
      unlinkSync(socketPath)
    } catch (error) {
      onError?.(new Error(`Failed to remove stale socket: ${error.message}`))
      throw error
    }
  }

  const clients = new Set<any>()
  let buffer = ""

  // ... rest of implementation
}
```

2. **Add signal handlers at canvas entry point**:

```typescript
// src/canvases/index.tsx

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H\x1b[?25l")
}

function showCursor() {
  process.stdout.write("\x1b[?25h")
}

let ipcServer: any = null  // Store globally for cleanup

export async function renderCanvas(
  kind: string,
  id: string,
  config?: unknown,
  options?: RenderOptions
): Promise<void> {
  clearScreen()

  // Critical: Install signal handlers BEFORE rendering
  const handleExit = () => {
    showCursor()
    ipcServer?.close()
    process.exit(0)
  }

  process.on("exit", showCursor)
  process.on("SIGINT", handleExit)
  process.on("SIGTERM", handleExit)
  process.on("SIGHUP", handleExit)

  try {
    switch (kind) {
      case "calendar":
        return await renderCalendar(id, config as CalendarConfig, options)
      // ... etc
    }
  } catch (error) {
    showCursor()
    ipcServer?.close()
    console.error(`Canvas error: ${error.message}`)
    process.exit(1)
  }
}

async function renderCalendar(id: string, config?: CalendarConfig, options?: RenderOptions) {
  const { waitUntilExit } = render(() => (
    <Calendar
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "display"}
      onIPCServerCreated={(server) => { ipcServer = server }}
    />
  ))
  await waitUntilExit()
}
```

3. **Add callback from useIPCServer hook**:

```typescript
export interface UseIPCServerOptions {
  socketPath: string | undefined
  scenario: string
  onClose?: () => void
  onUpdate?: (config: unknown) => void
  onIPCServerCreated?: (server: IPCServer) => void  // NEW
  // ... rest
}

export function useIPCServer(options: UseIPCServerOptions) {
  // ...
  onMount(async () => {
    if (!options.socketPath) return

    try {
      server = await createIPCServer({ socketPath: options.socketPath, ... })
      options.onIPCServerCreated?.(server)  // Pass server up
      setIsConnected(true)
    } catch (error) {
      console.error("Failed to create IPC server:", error)
    }
  })
  // ...
}
```

4. **Add explicit cleanup in renderer**:

```typescript
// Use OpenTUI's onExit hook if available, otherwise cleanup manually
createEffect(() => {
  const cleanup = () => {
    ipc.sendCancelled("window closed")
  }

  window?.addEventListener?.("beforeunload", cleanup)
  return () => window?.removeEventListener?.("beforeunload", cleanup)
})
```

**Prevention Checklist**:

- [ ] Ensure signal handlers installed before render
- [ ] Test socket cleanup after SIGINT
- [ ] Test stale socket removal on restart
- [ ] Verify `Bun.file().delete()` works for sockets
- [ ] Add socket cleanup logs for debugging
- [ ] Test parent process kill (tmux pane close)

**Severity**: CRITICAL  
**Impact**: Canvas crash = broken socket, user must manually `rm /tmp/canvas-*.sock`  
**Effort**: 2-3 hours

---

## C3: Prettier & Code Style Not Enforced

**Risk**: AGENTS.md specifies code style (no semicolons, 120 char width) but:

- No `.prettierrc` file in Phase 1
- No pre-commit hooks
- No lint CI check
- Developers add semicolons, vary indentation

**Location**: Phase 1 setup

**Mitigation Steps**:

1. **Create `.prettierrc` in Phase 1**:

```json
{
  "semi": false,
  "printWidth": 120,
  "trailingComma": "es5",
  "singleQuote": false,
  "arrowParens": "always"
}
```

2. **Add to `package.json` in Phase 1**:

```json
{
  "scripts": {
    "dev": "bun run src/cli.ts",
    "typecheck": "bunx tsc --noEmit",
    "test": "bun test",
    "build": "bun build src/cli.ts --outdir dist --target bun",
    "format": "bunx prettier --write .",
    "format:check": "bunx prettier --check .",
    "lint": "bun run format:check && bun run typecheck"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5",
    "prettier": "^3.0.0"
  }
}
```

3. **Create `.prettierignore`**:

```
node_modules/
dist/
.git/
bun.lock
```

4. **Add pre-commit hook** (optional but recommended):

```bash
#!/bin/sh
# .git/hooks/pre-commit
bun run format:check || exit 1
```

5. **Add CI step to README**:

```markdown
## Development

\`\`\`bash
bun run format:check # Check formatting
bun run format # Auto-fix formatting
bun run lint # Format + typecheck
bun test # Run tests
\`\`\`
```

**Prevention Checklist**:

- [ ] Add `.prettierrc` to Phase 1 deliverables
- [ ] Add `prettier` to devDependencies
- [ ] Create `.prettierignore`
- [ ] Run `bun run format:check` on all new files
- [ ] Document in AGENTS.md to update package.json

**Severity**: CRITICAL (code quality)  
**Impact**: Inconsistent code style, harder review, merge conflicts  
**Effort**: 30 minutes

---

# HIGH RISKS

## H1: IPC Test Coverage Insufficient

**Risk**: IMPLEMENTATION_PLAN.md Phase 2.4 shows only 1 basic test. Missing coverage for:

- Message parsing (invalid JSON, malformed)
- Broadcast to multiple clients
- Error callbacks
- Client disconnect during message
- Socket cleanup
- Timeout behavior

**Location**: `src/ipc/server.test.ts`, `src/ipc/client.test.ts`

**Mitigation Steps**:

1. **Expand server tests**:

```typescript
// src/ipc/server.test.ts
import { describe, test, expect, afterEach, beforeEach } from "bun:test"
import { createIPCServer } from "./server"
import { getSocketPath } from "./types"
import { createIPCClient } from "./client"

describe("IPC Server", () => {
  let testId: string
  let socketPath: string

  beforeEach(() => {
    testId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    socketPath = getSocketPath(testId)
  })

  afterEach(async () => {
    // Cleanup
    try {
      await Bun.file(socketPath).delete()
    } catch {}
  })

  test("creates socket file", async () => {
    const server = await createIPCServer({
      socketPath,
      onMessage: () => {},
    })
    expect(await Bun.file(socketPath).exists()).toBe(true)
    server.close()
  })

  test("parses and processes messages", async () => {
    const messages: any[] = []
    const server = await createIPCServer({
      socketPath,
      onMessage: (msg) => {
        messages.push(msg)
      },
    })

    const client = await createIPCClient(socketPath)
    await client.send({ type: "close" })
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(messages).toHaveLength(1)
    expect(messages[0].type).toBe("close")

    client.close()
    server.close()
  })

  test("broadcasts to multiple clients", async () => {
    const received: any[] = []
    const server = await createIPCServer({
      socketPath,
      onMessage: () => {},
    })

    const client1 = await createIPCClient(socketPath)
    const client2 = await createIPCClient(socketPath)

    client1.onMessage((msg) => received.push({ client: 1, msg }))
    client2.onMessage((msg) => received.push({ client: 2, msg }))

    server.broadcast({ type: "ready", scenario: "test" })
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(received).toHaveLength(2)
    expect(received[0].msg.type).toBe("ready")

    client1.close()
    client2.close()
    server.close()
  })

  test("handles invalid JSON gracefully", async () => {
    const errors: Error[] = []
    const server = await createIPCServer({
      socketPath,
      onMessage: () => {},
      onError: (error) => errors.push(error),
    })

    const client = await createIPCClient(socketPath)
    client.socket.write("{ invalid json }\n")
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toContain("Failed to parse")

    client.close()
    server.close()
  })

  test("cleans up socket on close", async () => {
    const server = await createIPCServer({
      socketPath,
      onMessage: () => {},
    })
    expect(await Bun.file(socketPath).exists()).toBe(true)

    server.close()
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(await Bun.file(socketPath).exists()).toBe(false)
  })

  test("notifies on client connect/disconnect", async () => {
    const events: string[] = []
    const server = await createIPCServer({
      socketPath,
      onMessage: () => {},
      onClientConnect: () => events.push("connect"),
      onClientDisconnect: () => events.push("disconnect"),
    })

    const client = await createIPCClient(socketPath)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(events).toContain("connect")

    client.close()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(events).toContain("disconnect")

    server.close()
  })
})
```

2. **Add client tests**:

```typescript
// src/ipc/client.test.ts
describe("IPC Client", () => {
  test("connects to socket", async () => {
    const server = await createIPCServer({
      socketPath,
      onMessage: () => {},
    })

    const client = await createIPCClient(socketPath)
    expect(client).toBeDefined()

    client.close()
    server.close()
  })

  test("sends messages", async () => {
    const messages: any[] = []
    const server = await createIPCServer({
      socketPath,
      onMessage: (msg) => messages.push(msg),
    })

    const client = await createIPCClient(socketPath)
    await client.send({ type: "ping" })
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(messages).toHaveLength(1)
    expect(messages[0].type).toBe("ping")

    client.close()
    server.close()
  })

  test("receives messages from server", async () => {
    const server = await createIPCServer({
      socketPath,
      onMessage: () => {},
    })

    const client = await createIPCClient(socketPath)
    const received: any[] = []
    client.onMessage((msg) => received.push(msg))

    server.broadcast({ type: "pong" })
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(received).toHaveLength(1)
    expect(received[0].type).toBe("pong")

    client.close()
    server.close()
  })
})
```

3. **Set test count targets**:

- IPC Server: ≥6 tests
- IPC Client: ≥3 tests
- Terminal: ≥3 tests
- Canvases: ≥11 tests (PHASE5_ADDON.md)
- **Total**: ≥23 tests

**Prevention Checklist**:

- [ ] Write tests BEFORE implementing features (TDD)
- [ ] Aim for ≥75% code coverage on IPC
- [ ] Test error paths (invalid JSON, timeout, disconnect)
- [ ] Test signal handling (SIGINT, SIGTERM)
- [ ] Run `bun test --coverage` before each phase

**Severity**: HIGH  
**Impact**: Undetected bugs in IPC, socket leaks, message loss  
**Effort**: 4-5 hours

---

## H2: Terminal Tests Missing

**Risk**: `src/terminal.ts` has complex spawning/pane reuse logic but IMPLEMENTATION_PLAN.md doesn't specify tests. Untested code = bugs in tmux interaction.

**Location**: Phase 3 deliverables

**Mitigation Steps**:

1. **Add terminal tests**:

```typescript
// src/terminal.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { detectTerminal, spawnCanvas } from "./terminal"

describe("Terminal Detection", () => {
  test("detects tmux environment", () => {
    const result = detectTerminal()
    expect(result).toHaveProperty("inTmux")
    expect(result).toHaveProperty("summary")
  })
})

describe("Canvas Spawning", () => {
  // Note: These tests may require tmux to be running
  // Skip if not in tmux

  test("throws error if not in tmux", async () => {
    if (process.env.TMUX) {
      test.skip("Running in tmux, skipping")
    }

    try {
      await spawnCanvas("calendar", "test-1")
      expect.unreachable()
    } catch (error) {
      expect(error.message).toContain("tmux")
    }
  })

  test("validates pane ID before reuse", async () => {
    // Mock tmux output to test validation logic
    // This requires refactoring spawnCanvas to accept mocked spawn
  })
})
```

2. **Add mock for spawning (optional, advanced)**:

```typescript
// src/terminal.test.ts
interface SpawnMock {
  spawnSync: typeof spawnSync
  spawn: typeof spawn
}

function withMockSpawn(mock: Partial<SpawnMock>, fn: () => Promise<void>) {
  const original = { spawnSync, spawn }
  Object.assign(globalThis, mock)
  try {
    return fn()
  } finally {
    Object.assign(globalThis, original)
  }
}
```

**Prevention Checklist**:

- [ ] Add terminal.test.ts in Phase 3
- [ ] Test detectTerminal() function
- [ ] Test pane validation logic
- [ ] Test graceful errors when tmux unavailable
- [ ] Document tmux requirement

**Severity**: HIGH  
**Impact**: Pane spawning failures, race conditions, user confusion  
**Effort**: 3-4 hours

---

## H3: Version Pinning & Dependency Management

**Risk**: IMPLEMENTATION_PLAN.md specifies:

- `@types/bun: latest` (drifts, breaks compatibility)
- `commander: ^14.0.0` (OK, minor version safe)
- `@opentui/core/solid: 0.1.72` (good, pinned)
- `solid-js: 1.9.9` (good, pinned)
- `typescript: ^5` (major version drift possible)

Unpinned versions can cause:

- Sudden breaking changes
- Incompatible types
- CI flakiness

**Location**: `package.json` Phase 1

**Mitigation Steps**:

1. **Pin all versions strictly**:

```json
{
  "dependencies": {
    "@opentui/core": "0.1.72",
    "@opentui/solid": "0.1.72",
    "commander": "14.0.0",
    "solid-js": "1.9.9"
  },
  "devDependencies": {
    "@types/bun": "1.1.0",
    "typescript": "5.3.0",
    "prettier": "3.0.0"
  }
}
```

2. **Document dependency choices in README**:

```markdown
## Dependencies

| Package        | Version | Reason                               |
| -------------- | ------- | ------------------------------------ |
| @opentui/core  | 0.1.72  | OpenCode compatibility (TUI toolkit) |
| @opentui/solid | 0.1.72  | OpenCode TUI for SolidJS             |
| solid-js       | 1.9.9   | @opentui/solid peer dependency       |
| commander      | 14.0.0  | CLI argument parsing                 |
| typescript     | 5.3.0   | Type checking                        |
| prettier       | 3.0.0   | Code formatting                      |
| @types/bun     | 1.1.0   | Bun runtime types                    |

**Why pinned**: OpenCode TUI versions are tightly coupled. Minor version drifts can break compatibility.
```

3. **Add version check in CI**:

```bash
#!/bin/bash
# scripts/check-versions.sh
bun --version
echo "Node: $(node --version)"
bunx tsc --version
```

**Prevention Checklist**:

- [ ] Pin all versions in package.json
- [ ] Document why each version is chosen
- [ ] Run `bun install` to lock lockfile
- [ ] Add version check to CI
- [ ] Document upgrade path for OpenTUI updates

**Severity**: HIGH  
**Impact**: Surprise breaking changes, CI failures, developer time lost debugging  
**Effort**: 1 hour

---

## H4: Async Lifecycle Ordering Issues

**Risk**: Canvas components call `createIPCServer()` (async) inside `onMount()`, but render flow may not wait properly. Messages could arrive before component fully initialized.

**Location**: `src/canvases/*.tsx`, useIPCServer hook

**Mitigation Steps**:

1. **Add initialization barrier**:

```tsx
export function Calendar(props: CalendarProps): JSX.Element {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const [isInitialized, setIsInitialized] = createSignal(false)
  const [viewState, setViewState] = createSignal<ViewState>({
    currentDate: getMonday(new Date()),
    selectedSlot: null,
    selectedEvent: null,
  })

  const ipc = useIPCServer({
    socketPath: props.socketPath,
    scenario: props.scenario,
    onClose: () => renderer.exit(),
    onUpdate: (config) => {
      // Only process updates after initialized
      if (!isInitialized()) return
      // ... handle update
    },
  })

  // Wait for IPC server to be ready
  createEffect(async () => {
    await new Promise((resolve) => {
      const check = () => {
        if (ipc.isConnected()) {
          ipc.sendReady()
          setIsInitialized(true)
          resolve(true)
        } else {
          setTimeout(check, 100)
        }
      }
      check()
    })
  })

  return (
    <Show when={isInitialized()} fallback={<text>Initializing...</text>}>
      {/* Render full calendar only after IPC ready */}
      <box width="100%" height="100%" flexDirection="column">
        {/* ... */}
      </box>
    </Show>
  )
}
```

2. **Add queue for early messages**:

```typescript
export function useIPCServer(options: UseIPCServerOptions) {
  const renderer = useRenderer()
  const [isConnected, setIsConnected] = createSignal(false)
  let server: IPCServer | null = null
  const messageQueue: ControllerMessage[] = []

  const processMessage = (msg: ControllerMessage) => {
    // If not ready, queue message
    if (!isConnected()) {
      messageQueue.push(msg)
      return
    }

    // Process immediately
    switch (msg.type) {
      case "update":
        options.onUpdate?.(msg.config)
        break
      // ...
    }
  }

  onMount(async () => {
    if (!options.socketPath) return

    try {
      server = await createIPCServer({
        socketPath: options.socketPath,
        onMessage: processMessage,
        // ...
      })
      setIsConnected(true)

      // Drain queue
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift()!
        processMessage(msg)
      }
    } catch (error) {
      console.error("Failed to create IPC server:", error)
    }
  })

  return {
    /* ... */
  }
}
```

**Prevention Checklist**:

- [ ] Add initialization sentinel in components
- [ ] Queue early messages
- [ ] Wait for IPC server before sendReady()
- [ ] Test by sending update immediately after spawn
- [ ] Add initialization timeout (5s) with error callback

**Severity**: HIGH  
**Impact**: Lost messages, silent failures, race conditions  
**Effort**: 2-3 hours

---

# MEDIUM RISKS

## M1: Incomplete Skills Documentation (Phase 7)

**Risk**: IMPLEMENTATION_PLAN.md Phase 7 shows placeholders for calendar/document/flight SKILL.md files but no content.

**Location**: `skills/calendar/SKILL.md`, `skills/document/SKILL.md`, `skills/flight/SKILL.md`

**Mitigation Steps**:

1. **Create skill template structure**:

```markdown
---
name: calendar
description: Interactive terminal calendar for event display and meeting scheduling
keywords: [calendar, scheduling, meeting-picker, time-slot]
---

# Calendar Canvas

## Overview

Interactive terminal-based calendar with week view, event display, and meeting time slot selection.

## Quick Start

\`\`\`bash

# Show calendar in current terminal

bun run src/cli.ts show calendar

# Spawn in tmux split (interactive)

bun run src/cli.ts spawn calendar --scenario meeting-picker --config '{
"events": [...],
"slotGranularity": 30
}'
\`\`\`

## Scenarios

### display

Show calendar with events. No interaction required.

### meeting-picker

Allow user to select 30-min time slots for scheduling.

## API Usage

\`\`\`typescript
import { pickMeetingTime } from "@/api"

const result = await pickMeetingTime({
events: [
{ id: "1", title: "Meeting", startTime: "2025-01-13T10:00", endTime: "2025-01-13T11:00" }
],
slotGranularity: 30,
})

if (result.success && result.data) {
console.log(\`Slot: \${result.data.startTime}\`)
}
\`\`\`

## Keyboard Shortcuts

| Key           | Action                             |
| ------------- | ---------------------------------- |
| ← / →         | Previous/next week                 |
| ↑ / ↓         | Select time slot (meeting-picker)  |
| t             | Jump to today                      |
| space / enter | Confirm selection (meeting-picker) |
| q / esc       | Quit                               |

## Configuration

\`\`\`typescript
interface CalendarConfig {
title?: string
events: CalendarEvent[]
slotGranularity?: number // 15, 30, 60
businessHoursOnly?: boolean
initialDate?: string
}

interface CalendarEvent {
id: string
title: string
startTime: string
endTime: string
color?: "blue" | "red" | "green" | "yellow"
attendees?: string[]
}
\`\`\`

## Limitations

- Display only (no creation/editing)
- One week at a time
- No recurring events
- No timezone handling

## See Also

- [Document Canvas](../document/SKILL.md)
- [Flight Canvas](../flight/SKILL.md)
```

2. **Create document skill template**:

```markdown
---
name: document
description: Terminal markdown editor with preview and selection tracking
keywords: [markdown, editor, document, email-preview]
---

# Document Canvas

## Scenarios

### display

View markdown content (read-only).

### edit

Edit markdown content with live preview.

### email-preview

Display email with headers and formatted content.

## API Usage

\`\`\`typescript
import { editDocument } from "@/api"

const result = await editDocument({
content: "# Hello\n\nEdit this...",
title: "My Document",
})

if (result.success && result.data) {
console.log("Saved:", result.data.content)
}
\`\`\`

## Keyboard Shortcuts

| Key    | Action           |
| ------ | ---------------- |
| ↑ / ↓  | Scroll           |
| ctrl+s | Save (edit mode) |
| q      | Quit             |

## Configuration

\`\`\`typescript
interface DocumentConfig {
title?: string
content: string
language?: "markdown" | "html" | "plaintext"
readOnly?: boolean
lineNumbers?: boolean
}
\`\`\`
```

3. **Create flight skill template**:

```markdown
---
name: flight
description: Interactive flight booking interface with seat selection
keywords: [flight, booking, travel, seat-selection]
---

# Flight Canvas

## Scenario

### booking

Compare flights and select seats.

## API Usage

\`\`\`typescript
import { spawnCanvasWithIPC } from "@/api"

const result = await spawnCanvasWithIPC("flight", "booking", {
flights: [...],
maxSelectableSeats: 4,
})

if (result.success && result.data) {
console.log("Booked:", result.data.flightId)
}
\`\`\`

## Keyboard Shortcuts

| Key   | Action                |
| ----- | --------------------- |
| ↑ / ↓ | Select flight / seat  |
| space | Toggle seat selection |
| enter | Confirm selection     |
| q     | Quit                  |
```

**Prevention Checklist**:

- [ ] Create SKILL.md for each canvas by end of Phase 7
- [ ] Include API usage examples
- [ ] Document all config options
- [ ] List keyboard shortcuts
- [ ] Add limitations/future work section
- [ ] Link between skills

**Severity**: MEDIUM  
**Impact**: Documentation gap, skill discovery issues, user confusion  
**Effort**: 3-4 hours

---

## M2: No Error Boundaries or Recovery

**Risk**: If a canvas component crashes (e.g., bad config, render error), entire app dies. No error recovery.

**Location**: `src/canvases/index.tsx`, component error handling

**Mitigation Steps**:

1. **Add error boundary wrapper**:

```tsx
// src/canvases/error-boundary.tsx
import { createSignal } from "solid-js"

interface ErrorBoundaryProps {
  children: any
  fallback?: (error: Error) => JSX.Element
}

export function ErrorBoundary(props: ErrorBoundaryProps): JSX.Element {
  const [error, setError] = createSignal<Error | null>(null)

  const handleError = (err: Error) => {
    console.error("Canvas error:", err.message)
    setError(err)
  }

  if (error()) {
    return (
      <box width="100%" height="100%" flexDirection="column" borderStyle="round">
        <text bold color="red">
          Error
        </text>
        <text>{error().message}</text>
        <text dimmed>Press q to quit</text>
      </box>
    )
  }

  return <box>{props.children}</box>
}
```

2. **Add validation to config parsing**:

```tsx
function renderCalendar(id: string, config?: CalendarConfig, options?: RenderOptions) {
  // Validate config before rendering
  if (config) {
    if (!Array.isArray(config.events)) {
      console.error("Invalid config: events must be an array")
      process.exit(1)
    }
    if (config.slotGranularity && ![15, 30, 60].includes(config.slotGranularity)) {
      console.error("Invalid slotGranularity: must be 15, 30, or 60")
      process.exit(1)
    }
  }

  const { waitUntilExit } = render(() => (
    <ErrorBoundary>
      <Calendar id={id} config={config} socketPath={options?.socketPath} scenario={options?.scenario || "display"} />
    </ErrorBoundary>
  ))
  return waitUntilExit()
}
```

**Prevention Checklist**:

- [ ] Add ErrorBoundary component
- [ ] Validate config schema before rendering
- [ ] Add try-catch around render()
- [ ] Test with invalid configs
- [ ] Log errors with context
- [ ] Add graceful degradation (fallback UI)

**Severity**: MEDIUM  
**Impact**: App crashes on bad config, poor error messages  
**Effort**: 2-3 hours

---

## M3: OpenTUI API Assumptions Not Validated

**Risk**: PHASE5_ADDON.md assumes OpenTUI API methods/props that may not exist or work as expected:

- `useRenderer()`, `useKeyboard()`, `useTerminalDimensions()`
- JSX element names (`<box>`, `<text>`, `<span>`)
- Flex properties (`flexDirection`, `flex`, etc.)
- Border/style props (`borderStyle`, `dimmed`, `bold`)

**Location**: Everywhere in Phase 5

**Mitigation Steps**:

1. **Create OpenTUI API validation script**:

```typescript
// scripts/validate-opentui.ts
import { render } from "@opentui/solid"

console.log("Testing OpenTUI API...")

// Test 1: useRenderer exists
try {
  const { useRenderer } = await import("@opentui/solid")
  console.log("✓ useRenderer exported")
} catch (e) {
  console.error("✗ useRenderer not found:", e.message)
}

// Test 2: useKeyboard exists
try {
  const { useKeyboard } = await import("@opentui/solid")
  console.log("✓ useKeyboard exported")
} catch (e) {
  console.error("✗ useKeyboard not found:", e.message)
}

// Test 3: Render a simple component
try {
  const { waitUntilExit } = render(() => (
    <box width="100%" height="10">
      <text>Test</text>
    </box>
  ))
  console.log("✓ JSX rendering works")
  // Note: This will hang, so timeout or skip
} catch (e) {
  console.error("✗ JSX rendering failed:", e.message)
}

console.log("API validation complete")
```

Add to `package.json`:

```json
{
  "scripts": {
    "validate:api": "bun scripts/validate-opentui.ts"
  }
}
```

2. **Reference OpenCode TUI source**:

```typescript
// README.md
## API Reference

Before implementing, review OpenCode's actual TUI usage:

\`\`\`
/Users/davidhelmus/Repos/opencode/packages/opencode/src/cli/cmd/tui/
\`\`\`

Copy patterns from existing components in that directory.
```

3. **Test first with minimal component**:

```tsx
// src/canvases/test.tsx - Validation component
import { createSignal } from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"

export function TestCanvas(): JSX.Element {
  const renderer = useRenderer()
  const [count, setCount] = createSignal(0)

  useKeyboard((key) => {
    console.log("Key:", key.name)
    if (key.name === "up") setCount((c) => c + 1)
  })

  return (
    <box width="100%" height="100%" flexDirection="column">
      <text>Test Counter: {count()}</text>
      <text dimmed>Press up arrow or q to quit</text>
    </box>
  )
}
```

Run:

```bash
bun run src/cli.ts show test
```

**Prevention Checklist**:

- [ ] Run `bun run validate:api` before Phase 5
- [ ] Review `/opencode/src/cli/cmd/tui/` for patterns
- [ ] Test each OpenTUI prop in isolation
- [ ] Document actual API surface (vs assumptions)
- [ ] Create test component early (Phase 5 start)
- [ ] Ask Skeptomenos (user) if API unclear

**Severity**: MEDIUM  
**Impact**: Phase 5 components fail at render time  
**Effort**: 4-5 hours (if API differs significantly)

---

# LOW RISKS

## L1: Missing Error Handling in CLI

**Risk**: `src/cli.ts` doesn't handle parsing errors or invalid canvas kind gracefully.

**Mitigation**:

```typescript
program
  .command("show [kind]")
  .description("Show a canvas in the current terminal")
  .option("--id <id>", "Canvas ID")
  .option("--config <json>", "Canvas configuration (JSON)")
  .option("--socket <path>", "Unix socket path for IPC")
  .option("--scenario <name>", "Scenario name")
  .action(async (kind = "calendar", options) => {
    // Validate kind
    const validKinds = ["calendar", "document", "flight"]
    if (!validKinds.includes(kind)) {
      console.error(`Unknown canvas: ${kind}`)
      console.error(`Valid options: ${validKinds.join(", ")}`)
      process.exit(1)
    }

    // Parse config
    let config: unknown
    if (options.config) {
      try {
        config = JSON.parse(options.config)
      } catch (error) {
        console.error(`Invalid JSON in --config: ${error.message}`)
        process.exit(1)
      }
    }

    const id = options.id || `${kind}-1`
    setWindowTitle(`canvas: ${kind}`)

    try {
      const { renderCanvas } = await import("./canvases")
      await renderCanvas(kind, id, config, {
        socketPath: options.socket,
        scenario: options.scenario || "display",
      })
    } catch (error) {
      console.error(`Canvas error: ${error.message}`)
      process.exit(1)
    }
  })
```

## L2: No Logging Framework

**Risk**: Hard to debug issues. Console.log goes everywhere.

**Mitigation**: Use simple log function:

```typescript
// src/utils/logger.ts
export function log(level: "info" | "warn" | "error", msg: string, data?: unknown) {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`

  if (data) {
    console.error(`${prefix} ${msg}`, data) // Use console.error for stderr
  } else {
    console.error(`${prefix} ${msg}`)
  }
}

export const logger = { info: (m, d) => log("info", m, d) /* ... */ }
```

Use in canvas:

```typescript
logger.info("Canvas mounted", { id: props.id, scenario: props.scenario })
```

## L3: No README Examples

**Risk**: Users don't know how to use the library.

**Mitigation**: Create comprehensive README in Phase 8:

```markdown
# OpenCode Canvas

Interactive terminal canvases for OpenCode.

## Installation

\`\`\`bash
cd /path/to/opencode-canvas
bun install
\`\`\`

## Usage

### CLI

\`\`\`bash

# Show calendar in current terminal

bun run src/cli.ts show calendar

# Spawn in tmux split

bun run src/cli.ts spawn document --config '{...}'
\`\`\`

### API

\`\`\`typescript
import { pickMeetingTime } from "./src/api"

const result = await pickMeetingTime({ /_ ... _/ })
if (result.success) {
console.log("Selected:", result.data)
}
\`\`\`

## Development

\`\`\`bash
bun run format:check
bun run lint
bun test
\`\`\`
```

---

# Implementation Checklist

Use this checklist throughout implementation:

## Phase 1: Setup

- [ ] `.prettierrc` added and formatted
- [ ] Version pinning verified
- [ ] Directory structure created
- [ ] `bun install` succeeds

## Phase 2: IPC

- [ ] ≥6 server tests pass
- [ ] ≥3 client tests pass
- [ ] Signal handlers added
- [ ] Socket cleanup verified

## Phase 3: Terminal

- [ ] Pane validation implemented
- [ ] Lockfile mechanism added
- [ ] ≥3 terminal tests pass
- [ ] Concurrent spawn tested

## Phase 4: CLI

- [ ] Config validation in place
- [ ] Error handling for invalid kind
- [ ] Help text complete

## Phase 5: Canvases

- [ ] OpenTUI API validated (validate:api passes)
- [ ] Test component renders
- [ ] Calendar ≥4 tests
- [ ] Document ≥4 tests
- [ ] Flight ≥3 tests
- [ ] ErrorBoundary wraps all canvases

## Phase 6: API

- [ ] High-level API functions exported
- [ ] Timeout handling works
- [ ] Message flow tested

## Phase 7: Skills

- [ ] Canvas SKILL.md complete
- [ ] Calendar SKILL.md complete
- [ ] Document SKILL.md complete
- [ ] Flight SKILL.md complete

## Phase 8: Polish

- [ ] All tests pass (`bun test`)
- [ ] `bun run format:check` passes
- [ ] `bun run typecheck` passes
- [ ] README complete with examples
- [ ] AGENTS.md updated with commands
- [ ] Manual testing complete

---

# Summary

| Risk                      | Severity | Mitigation                           | Hours |
| ------------------------- | -------- | ------------------------------------ | ----- |
| Pane reuse race condition | CRITICAL | Validation + locking + fallback      | 2-3   |
| Socket cleanup on exit    | CRITICAL | Signal handlers + aggressive cleanup | 2-3   |
| Prettier not enforced     | CRITICAL | Add .prettierrc + npm script         | 0.5   |
| IPC tests insufficient    | HIGH     | Add ≥9 tests                         | 4-5   |
| Terminal tests missing    | HIGH     | Add ≥3 tests                         | 3-4   |
| Version pinning           | HIGH     | Pin all deps, document choices       | 1     |
| Async initialization      | HIGH     | Initialization barrier + queue       | 2-3   |
| Skills docs incomplete    | MEDIUM   | Create templates for 3 skills        | 3-4   |
| No error recovery         | MEDIUM   | ErrorBoundary + config validation    | 2-3   |
| OpenTUI API assumptions   | MEDIUM   | Validate API early, test component   | 4-5   |
| CLI error handling        | LOW      | Add validation & error messages      | 1     |
| No logging                | LOW      | Simple logger utility                | 0.5   |
| No README                 | LOW      | Comprehensive examples               | 1.5   |
| **Total**                 | —        | **~38 hours**                        | —     |

**Total project estimate**: 64-80 hours (IMPLEMENTATION_PLAN.md) + 38 hours (mitigations) = **102-118 hours**

Or focus on CRITICAL risks first (7 hours), ship MVP, then iterate.
