# Issue Mitigation Plan

**Created:** January 10, 2026
**Based on:** Comprehensive Code Review

---

## Overview

| Priority  | Count  | Estimated Effort |
| --------- | ------ | ---------------- |
| High      | 3      | 2-3 hours        |
| Medium    | 11     | 4-6 hours        |
| Low       | 8      | 2-3 hours        |
| **Total** | **22** | **8-12 hours**   |

---

## High Priority Issues (Fix Immediately)

### H1. Type Assertions Using `as unknown as` Pattern

**File:** `src/api/canvas-api.ts:51`
**Risk:** Runtime type errors hidden by double assertion
**Effort:** 30 minutes

**Current Code:**

```typescript
const canvasMsg = msg as unknown as CanvasMessage
```

**Mitigation:**

1. Create a type guard function in `src/ipc/types.ts`:

```typescript
export function isCanvasMessage(msg: unknown): msg is CanvasMessage {
  if (typeof msg !== "object" || msg === null) return false
  const m = msg as Record<string, unknown>
  return typeof m.type === "string" && ["ready", "selected", "cancelled", "error"].includes(m.type)
}
```

2. Update `canvas-api.ts` to use the type guard:

```typescript
if (isCanvasMessage(msg)) {
  switch (msg.type) { ... }
} else {
  console.error('Invalid message format:', msg)
}
```

**Verification:** Run `bun run typecheck` and `bun test`

---

### H2. Shared Buffer State Across Connections (Race Condition)

**File:** `src/ipc/server.ts:26`
**Risk:** Message corruption with multiple simultaneous clients
**Effort:** 45 minutes

**Current Code:**

```typescript
let buffer = "" // Shared across ALL connections
```

**Mitigation:**

1. Create a Map to track per-socket buffers:

```typescript
const socketBuffers = new Map<unknown, string>()

// In socket.open:
socketBuffers.set(socket, "")

// In socket.data:
const currentBuffer = socketBuffers.get(socket) || ""
const newBuffer = currentBuffer + data.toString()
// ... process messages ...
socketBuffers.set(socket, remainingBuffer)

// In socket.close:
socketBuffers.delete(socket)
```

2. Alternative: Use Bun's socket data property if available

**Verification:**

- Write a test that opens 2 concurrent connections sending interleaved messages
- Verify each connection receives correct responses

---

### H3. Promise Rejection Not Handled in spawnCanvasWithIPC

**File:** `src/api/canvas-api.ts:48-75`
**Risk:** Race condition between server creation and canvas spawn; unhandled rejections
**Effort:** 30 minutes

**Current Code:**

```typescript
createIPCServer({...}).then((s) => {
  server = s
})
// ...
spawnCanvas(kind, id, ...).catch(...)  // May run before server is ready
```

**Mitigation:**

1. Refactor to use async/await with proper sequencing:

```typescript
async function initializeCanvas() {
  try {
    server = await createIPCServer({...})
    await spawnCanvas(kind, id, ...)
  } catch (err) {
    cleanup()
    handleResolve({
      success: false,
      error: err instanceof Error ? err.message : String(err)
    })
  }
}
initializeCanvas()
```

2. Ensure cleanup is called in all error paths

**Verification:**

- Test with invalid socket path to trigger server creation failure
- Verify no dangling processes or socket files

---

## Medium Priority Issues (Fix This Sprint)

### M1-M3. Dead Code Removal

**Files:** Multiple
**Effort:** 1 hour

**Unused Exports to Remove:**

| Function                        | File                      | Action                             |
| ------------------------------- | ------------------------- | ---------------------------------- |
| `clampCursorCol`                | `editor-state.ts:53`      | Remove                             |
| `markLinesDirty`                | `editor-state.ts:59`      | Remove                             |
| `clearDirtyLines`               | `editor-state.ts:67`      | Remove                             |
| `isColonWCommand`               | `editor-save.ts:126`      | Remove                             |
| `getConfirmationPrompt`         | `editor-save.ts:56`       | Remove                             |
| `getFilenameWithDirtyIndicator` | `editor-quit.ts:97`       | Remove                             |
| `hasClipboardContent`           | `editor-clipboard.ts:134` | Remove                             |
| `findOriginalLineIndex`         | `word-wrap.ts:80`         | Keep (may be needed for edit mode) |
| `closeCanvasPane`               | `terminal.ts:211`         | Remove or document as future API   |

**Unused Imports to Remove:**

| Import                               | File               | Action |
| ------------------------------------ | ------------------ | ------ |
| `onCleanup`, `createEffect`          | `editor.tsx:1`     | Remove |
| `getCurrentLine`, `getEditorContent` | `editor.tsx:5`     | Remove |
| `beforeEach`                         | `server.test.ts:1` | Remove |

**Mitigation Steps:**

1. Run `bun run typecheck` to establish baseline
2. Remove each unused export/import
3. Run `bun run typecheck` after each removal to verify no breakage
4. Run `bun test` to ensure tests still pass

---

### M4-M6. Code Duplication Extraction

**Files:** `file-viewer.tsx`, `tree-file-viewer.tsx`, `browser.tsx`, `tree-browser.tsx`
**Effort:** 1.5 hours

**Mitigation:**

1. Create `src/canvases/utils/file-utils.ts`:

```typescript
export const VIEWABLE_EXTENSIONS = new Set([
  "md",
  "txt",
  "json",
  "yaml",
  "yml",
  "toml",
  "ts",
  "tsx",
  "js",
  "jsx",
  "css",
  "html",
  "xml",
  "sh",
  "bash",
  "zsh",
  "py",
  "rb",
  "go",
  "rs",
  "c",
  "cpp",
  "h",
  "hpp",
  "java",
  "kt",
  "swift",
  "sql",
  "graphql",
  "env",
  "gitignore",
  "dockerignore",
  "editorconfig",
  "prettierrc",
  "eslintrc",
])

export function isViewable(path: string): boolean {
  const name = path.split("/").pop() || ""
  if (name.startsWith(".") && !name.includes(".", 1)) return true
  const ext = name.split(".").pop()?.toLowerCase() || ""
  return VIEWABLE_EXTENSIONS.has(ext)
}

export async function loadFileContent(path: string): Promise<DocumentConfig> {
  const file = Bun.file(path)
  const content = await file.text()
  const filename = path.split("/").pop() || path
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  return {
    content,
    title: filename,
    format: ext === "md" ? "markdown" : "plain",
    readOnly: true,
  }
}
```

2. Create `src/canvases/utils/fs-utils.ts`:

```typescript
import { readdir, stat } from "fs/promises"

export interface DirectoryEntry {
  name: string
  path: string
  isDir: boolean
  size: number
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}

export async function readDirectory(dirPath: string, showHidden: boolean): Promise<DirectoryEntry[]> {
  // Consolidated implementation
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`
}
```

3. Update imports in all affected files
4. Run typecheck and tests

---

### M7. Replace `let` with `const` (Style Guide Compliance)

**Files:** Multiple (24 instances)
**Effort:** 1 hour

**Mitigation Strategy:**

| Location               | Current                      | Refactor To                                                         |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------- |
| `ipc/server.ts:26`     | `let buffer`                 | Per-socket Map (see H2)                                             |
| `ipc/client.ts:21-22`  | `let buffer, connected`      | Object with const: `const state = { buffer: "", connected: false }` |
| `terminal.ts:112,168`  | `let command, paneId`        | Use const with reassignment via function returns                    |
| `editor-navigation.ts` | Multiple `let` for positions | Return new values instead of mutating                               |

**Example Refactor for client.ts:**

```typescript
// Before
let buffer = ""
let connected = false

// After
const state = { buffer: "", connected: false }
// Use state.buffer and state.connected
```

---

### M8. Replace Shell Spawn with Native FS for isDirectory

**Files:** `browser.tsx:57-64`, `tree-browser.tsx:66-73`
**Effort:** 30 minutes

**Current Code:**

```typescript
async function isDirectory(path: string): Promise<boolean> {
  const proc = Bun.spawnSync(["test", "-d", path])
  return proc.exitCode === 0
}
```

**Mitigation:**

```typescript
import { stat } from "fs/promises"

async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}
```

This will be consolidated into `fs-utils.ts` as part of M4-M6.

---

### M9. IPC Server Cleanup on spawnCanvas Failure

**File:** `src/api/canvas-api.ts:31-84`
**Effort:** 20 minutes

**Mitigation:**
Ensure `cleanup()` is called in all error paths:

```typescript
spawnCanvas(kind, id, socketPath, config).catch((err) => {
  cleanup() // Add this line
  handleResolve({ success: false, error: err.message })
})
```

Also add cleanup to the timeout handler if one exists.

---

### M10. Document Signal Handler Behavior for IPC

**File:** `src/canvases/calendar/hooks/use-ipc-server.ts`
**Effort:** 15 minutes

**Mitigation:**

1. Add comment documenting that stale socket cleanup is handled in `server.ts:21-23`
2. Optionally add SIGTERM/SIGINT handlers in long-running canvas processes

---

### M11. Replace Non-Null Assertions with Keyed Match

**Files:** `file-viewer.tsx:143`, `tree-file-viewer.tsx:137`
**Effort:** 20 minutes

**Current Code:**

```tsx
<Match when={mode() !== "browse" && docConfig()}>
  <Document config={docConfig()!} ... />
</Match>
```

**Mitigation:**

```tsx
<Match when={mode() !== "browse" && docConfig()} keyed>
  {(config) => <Document config={config} ... />}
</Match>
```

This provides type-safe access to the config without assertions.

---

## Low Priority Issues (Fix When Convenient)

### L1. Add Error Logging to Empty Catch Blocks

**Files:** `editor-save.ts:61-85`, `editor-readonly.ts:19-53`
**Effort:** 20 minutes

**Mitigation:**

```typescript
// Before
} catch {
  return false
}

// After
} catch (err) {
  if (process.env.DEBUG) console.error('Operation failed:', err)
  return false
}
```

---

### L2. Extract Magic Numbers to Constants

**File:** `terminal.ts`
**Effort:** 15 minutes

**Mitigation:**
Create a constants section at the top of the file:

```typescript
const CONFIG = {
  REUSE_TIMEOUT_MS: 2000,
  LOCK_TIMEOUT_MS: 5000,
  LOCK_STALE_MS: 30000,
} as const
```

---

### L3. Add JSDoc to Public API

**File:** `src/api/canvas-api.ts`
**Effort:** 30 minutes

**Mitigation:**

```typescript
/**
 * Spawns a canvas with IPC communication and waits for user interaction.
 *
 * @param kind - The type of canvas to spawn ('calendar' | 'document' | 'flight')
 * @param config - Canvas-specific configuration
 * @returns Promise resolving to success/failure with selected data or error
 *
 * @example
 * const result = await spawnCanvasWithIPC('calendar', { events: [] })
 * if (result.success) {
 *   console.log('Selected:', result.data)
 * }
 */
export async function spawnCanvasWithIPC<T>(...): Promise<CanvasResult<T>>
```

---

### L4. Add Tests for Editor Modules

**Files:** `src/canvases/editor/*.ts`
**Effort:** 2-3 hours (separate task)

**Mitigation:**
Create `src/canvases/editor/editor.test.ts` with tests for:

- Navigation functions (moveUp, moveDown, moveToWord, etc.)
- Clipboard operations (yank, paste)
- Undo/redo stack behavior
- State management

**Priority Order:**

1. `editor-undo.ts` - Critical for data safety
2. `editor-navigation.ts` - Core functionality
3. `editor-clipboard.ts` - Data integrity
4. `editor-state.ts` - Foundation

---

### L5. Make Socket Path Configurable

**File:** `src/ipc/types.ts:30-32`
**Effort:** 15 minutes

**Mitigation:**

```typescript
const SOCKET_DIR = process.env.CANVAS_SOCKET_DIR || process.env.XDG_RUNTIME_DIR || "/tmp"

export function getSocketPath(id: string): string {
  return `${SOCKET_DIR}/canvas-${id}.sock`
}
```

---

### L6. Remove Unused `render` Import

**File:** `src/canvases/file-viewer.tsx:2`
**Effort:** 5 minutes

**Mitigation:**
Check if `render` is used in `renderFileViewer` function. If yes, keep it. If no, remove.

---

### L7. Add Boundary Check in Calendar Navigation

**File:** `src/canvases/calendar.tsx:99-103`
**Effort:** 10 minutes

**Mitigation:**

```typescript
const endSlotIndex = Math.min(selectedSlot() + 1, timeSlots().length - 1)
if (endSlotIndex < 0 || endSlotIndex >= timeSlots().length) return
const endSlot = timeSlots()[endSlotIndex]
if (!day || !slot || !endSlot) return
```

---

### L8. Fix Stale Closure in setTimeout

**File:** `src/canvases/editor/editor.tsx:192-194`
**Effort:** 15 minutes

**Mitigation:**

```typescript
let messageTimeoutId: ReturnType<typeof setTimeout> | null = null

const showTemporaryMessage = (message: string, duration = 2000) => {
  if (messageTimeoutId) clearTimeout(messageTimeoutId)
  setStatusMessage(message)
  messageTimeoutId = setTimeout(() => {
    setStatusMessage(null)
    messageTimeoutId = null
  }, duration)
}
```

---

## Implementation Schedule

### Phase 1: High Priority (Day 1)

- [ ] H1: Type guard for CanvasMessage
- [ ] H2: Per-socket buffer management
- [ ] H3: Async/await refactor for canvas spawn

### Phase 2: Medium Priority - Dead Code (Day 1-2)

- [ ] M1-M3: Remove unused exports and imports

### Phase 3: Medium Priority - Deduplication (Day 2)

- [ ] M4-M6: Create shared utility modules
- [ ] M8: Replace shell spawn with native fs

### Phase 4: Medium Priority - Cleanup (Day 2-3)

- [ ] M7: Replace `let` with `const` patterns
- [ ] M9-M10: IPC cleanup improvements
- [ ] M11: Keyed Match pattern

### Phase 5: Low Priority (Day 3+)

- [ ] L1-L8: Address as time permits

---

## Verification Checklist

After each phase:

- [ ] `bun run typecheck` passes
- [ ] `bun test` passes (6 tests)
- [ ] `bun run lint` passes
- [ ] Manual testing of affected features
- [ ] Commit with descriptive message

---

## Success Criteria

- All High Priority issues resolved
- All Medium Priority issues resolved
- Code review score improved from 7.5/10 to 9/10
- No regressions in existing functionality
- Test suite still passing
