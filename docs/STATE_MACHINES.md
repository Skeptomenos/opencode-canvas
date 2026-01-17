# OpenCode Canvas - State Machine Documentation

This document provides detailed state machine diagrams for all components in the OpenCode Canvas system.

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [IPC Protocol State Machine](#2-ipc-protocol-state-machine)
3. [Canvas Lifecycle State Machine](#3-canvas-lifecycle-state-machine)
4. [Editor Component State Machine](#4-editor-component-state-machine)
5. [FileViewer Composite State Machine](#5-fileviewer-composite-state-machine)
6. [Calendar Canvas State Machine](#6-calendar-canvas-state-machine)
7. [Flight Canvas State Machine](#7-flight-canvas-state-machine)
8. [FileBrowser / TreeBrowser State Machine](#8-filebrowser--treebrowser-state-machine)
9. [tmux Spawn State Machine](#9-tmux-spawn-state-machine)
10. [Summary of State Patterns](#10-summary-of-state-patterns)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           OPENCODE CANVAS SYSTEM                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐     spawn/show      ┌──────────────────┐                      │
│  │   CLI.ts     │ ──────────────────► │  renderCanvas()  │                      │
│  │              │                      │  (index.tsx)     │                      │
│  └──────────────┘                      └────────┬─────────┘                      │
│         │                                       │                                │
│         │ spawn (tmux)                          │ switch(kind)                   │
│         ▼                                       ▼                                │
│  ┌──────────────┐                      ┌──────────────────┐                      │
│  │ terminal.ts  │                      │ Canvas Component │                      │
│  │ - acquireLock│                      │ - Calendar       │                      │
│  │ - createPane │                      │ - Document       │                      │
│  │ - reusePane  │                      │ - Flight         │                      │
│  └──────────────┘                      │ - FileBrowser    │                      │
│                                        │ - TreeBrowser    │                      │
│                                        │ - FileViewer     │                      │
│                                        │ - Editor         │                      │
│                                        └────────┬─────────┘                      │
│                                                 │                                │
│                                                 │ useIPCServer()                 │
│                                                 ▼                                │
│                                        ┌──────────────────┐                      │
│                                        │   IPC Server     │                      │
│                                        │ (Unix Socket)    │                      │
│                                        └──────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component Relationships

| Source File | Role | Dependencies |
|-------------|------|--------------|
| `src/cli.ts` | CLI entry point | commander, terminal.ts, canvases/index.tsx |
| `src/terminal.ts` | tmux detection & pane management | Bun APIs, child_process |
| `src/canvases/index.tsx` | Canvas router & renderer | All canvas components |
| `src/ipc/server.ts` | Unix socket server | Bun.listen |
| `src/ipc/client.ts` | Unix socket client | Bun.connect |
| `src/ipc/types.ts` | Message type definitions | - |

---

## 2. IPC Protocol State Machine

The IPC system uses Unix domain sockets for bidirectional communication between the canvas and an external controller.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              IPC MESSAGE FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  CANVAS → CONTROLLER                    CONTROLLER → CANVAS                     │
│  ═══════════════════                    ═══════════════════                     │
│                                                                                  │
│  ┌─────────┐                            ┌─────────┐                             │
│  │  ready  │ ─── scenario: string       │  close  │ ─── terminate canvas        │
│  └─────────┘                            └─────────┘                             │
│                                                                                  │
│  ┌──────────┐                           ┌─────────┐                             │
│  │ selected │ ─── data: unknown         │ update  │ ─── config: unknown         │
│  └──────────┘                           └─────────┘                             │
│                                                                                  │
│  ┌───────────┐                          ┌─────────┐                             │
│  │ cancelled │ ─── reason?: string      │  ping   │ ─── health check            │
│  └───────────┘                          └─────────┘                             │
│                                                                                  │
│  ┌─────────┐                            ┌──────────────┐                        │
│  │  error  │ ─── message: string        │ getSelection │ ─── request selection  │
│  └─────────┘                            └──────────────┘                        │
│                                                                                  │
│  ┌─────────┐                            ┌────────────┐                          │
│  │  pong   │ ─── response to ping       │ getContent │ ─── request content      │
│  └─────────┘                            └────────────┘                          │
│                                                                                  │
│  ┌───────────┐                                                                  │
│  │ selection │ ─── SelectionData | null                                         │
│  └───────────┘                                                                  │
│                                                                                  │
│  ┌─────────┐                                                                    │
│  │ content │ ─── ContentData                                                    │
│  └─────────┘                                                                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Message Type Definitions

```typescript
// Canvas → Controller
type CanvasMessage =
  | { type: "ready"; scenario: string }
  | { type: "selected"; data: unknown }
  | { type: "cancelled"; reason?: string }
  | { type: "error"; message: string }
  | { type: "pong" }
  | { type: "selection"; data: SelectionData | null }
  | { type: "content"; data: ContentData }

// Controller → Canvas
type ControllerMessage =
  | { type: "close" }
  | { type: "update"; config: unknown }
  | { type: "ping" }
  | { type: "getSelection" }
  | { type: "getContent" }
```

### IPC Connection Lifecycle

```
┌──────────────┐                              ┌──────────────┐
│   CANVAS     │                              │  CONTROLLER  │
└──────┬───────┘                              └──────┬───────┘
       │                                             │
       │ createIPCServer(socketPath)                 │
       │ ◄───────────────────────────────────────────│
       │                                             │
       │ ─────────── socket connect ────────────────►│
       │                                             │
       │ ◄────────── { type: "ready" } ─────────────│
       │                                             │
       │              ... interaction ...            │
       │                                             │
       │ ◄────────── { type: "ping" } ──────────────│
       │ ─────────── { type: "pong" } ─────────────►│
       │                                             │
       │ ◄────────── { type: "selected" } ──────────│
       │              OR                             │
       │ ◄────────── { type: "cancelled" } ─────────│
       │                                             │
       │ ─────────── socket close ─────────────────►│
       │                                             │
       ▼                                             ▼
```

---

## 3. Canvas Lifecycle State Machine

All canvas components follow a common lifecycle pattern.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          CANVAS LIFECYCLE STATES                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                              ┌───────────┐                                       │
│                              │INITIALIZING│                                      │
│                              └─────┬─────┘                                       │
│                                    │ onMount()                                   │
│                                    │ ipc.sendReady()                             │
│                                    ▼                                             │
│                              ┌───────────┐                                       │
│                              │   READY   │◄──────────────────┐                   │
│                              └─────┬─────┘                   │                   │
│                                    │                         │                   │
│              ┌─────────────────────┼─────────────────────┐   │                   │
│              │                     │                     │   │                   │
│              ▼                     ▼                     ▼   │                   │
│       ┌────────────┐        ┌────────────┐        ┌──────────┴─┐                 │
│       │ NAVIGATING │        │ SELECTING  │        │  UPDATING  │                 │
│       │ (keyboard) │        │ (Enter)    │        │ (IPC msg)  │                 │
│       └─────┬──────┘        └─────┬──────┘        └────────────┘                 │
│             │                     │                                              │
│             │                     │ ipc.sendSelected(data)                       │
│             │                     ▼                                              │
│             │              ┌───────────┐                                         │
│             │              │ COMPLETED │                                         │
│             │              └───────────┘                                         │
│             │                                                                    │
│             │ (q/Escape)                                                         │
│             │ ipc.sendCancelled()                                                │
│             ▼                                                                    │
│       ┌───────────┐                                                              │
│       │ CANCELLED │                                                              │
│       └─────┬─────┘                                                              │
│             │ renderer.destroy()                                                 │
│             │ props.onExit()                                                     │
│             ▼                                                                    │
│       ┌───────────┐                                                              │
│       │  EXITED   │                                                              │
│       └───────────┘                                                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### State Transitions Table

| Current State | Event | Next State | Action |
|---------------|-------|------------|--------|
| INITIALIZING | onMount() | READY | ipc.sendReady() |
| READY | keyboard input | NAVIGATING | Update selection state |
| READY | IPC update message | UPDATING | Apply config changes |
| NAVIGATING | Enter key | SELECTING | Prepare selection data |
| SELECTING | - | COMPLETED | ipc.sendSelected(data) |
| NAVIGATING | q/Escape | CANCELLED | ipc.sendCancelled() |
| CANCELLED | - | EXITED | renderer.destroy(), onExit() |
| UPDATING | - | READY | Re-render with new config |

---

## 4. Editor Component State Machine

The Editor is the most complex component with multiple orthogonal state machines.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EDITOR STATE MACHINE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         EditorMode (Primary)                             │    │
│  │                                                                          │    │
│  │     ┌──────────┐                              ┌──────────┐              │    │
│  │     │  NORMAL  │◄────────── Escape ──────────│  INSERT  │              │    │
│  │     │          │                              │          │              │    │
│  │     │ h/j/k/l  │────── i/a/o/O/I/A ─────────►│ typing   │              │    │
│  │     │ w/b/0/$  │                              │ Enter    │              │    │
│  │     │ gg/G     │                              │ Backspace│              │    │
│  │     │ x/dd/yy  │                              │ arrows   │              │    │
│  │     │ p/P/u    │                              │          │              │    │
│  │     └────┬─────┘                              └──────────┘              │    │
│  │          │                                                               │    │
│  │          │ ":"                                                           │    │
│  │          ▼                                                               │    │
│  │     ┌──────────┐                                                         │    │
│  │     │ COMMAND  │ ─── :w :q :wq :q! ───► Execute                         │    │
│  │     │  MODE    │ ─── Escape ───────────► NORMAL                         │    │
│  │     └──────────┘                                                         │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### EditorMode Transitions

| Current Mode | Key | Next Mode | Action |
|--------------|-----|-----------|--------|
| NORMAL | i | INSERT | Enter insert before cursor |
| NORMAL | a | INSERT | Enter insert after cursor |
| NORMAL | o | INSERT | Open line below, enter insert |
| NORMAL | O | INSERT | Open line above, enter insert |
| NORMAL | I | INSERT | Move to line start, enter insert |
| NORMAL | A | INSERT | Move to line end, enter insert |
| NORMAL | : | COMMAND | Start command input |
| INSERT | Escape | NORMAL | Exit insert mode |
| COMMAND | Escape | NORMAL | Cancel command |
| COMMAND | Enter | NORMAL | Execute command |

### SaveState (Overlay State Machine)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SaveState                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│     ┌──────────┐         :w / Ctrl+S        ┌────────────┐                      │
│     │   IDLE   │ ──────────────────────────►│ CONFIRMING │                      │
│     └──────────┘                            └──────┬─────┘                      │
│          ▲                                         │                             │
│          │                              ┌──────────┼──────────┐                  │
│          │                              │ y        │ n/Esc    │                  │
│          │                              ▼          ▼          │                  │
│          │                        ┌─────────┐ ┌─────────┐     │                  │
│          └────────────────────────│ SAVING  │ │CANCELLED│─────┘                  │
│                                   └────┬────┘ └─────────┘                        │
│                                        │                                         │
│                                        ▼                                         │
│                                   ┌─────────┐                                    │
│                                   │  SAVED  │ ─── "Saved" message (2s)           │
│                                   └─────────┘                                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### QuitState (Overlay State Machine)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              QuitState                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│     ┌──────────┐         :q / q / Esc       ┌────────────┐                      │
│     │   IDLE   │ ──────────────────────────►│ CONFIRMING │                      │
│     └──────────┘    (if isDirty)            │ "Save? y/n"│                      │
│          │                                  └──────┬─────┘                      │
│          │ (if !isDirty)                           │                             │
│          │                           ┌─────────────┼─────────────┐               │
│          │                           │ y           │ n           │ c/Esc         │
│          │                           ▼             ▼             ▼               │
│          │                    ┌───────────┐ ┌───────────┐ ┌─────────┐           │
│          └───────────────────►│SAVE & QUIT│ │QUIT NO SAV│ │CANCELLED│           │
│                               └─────┬─────┘ └─────┬─────┘ └─────────┘           │
│                                     │             │                              │
│                                     └──────┬──────┘                              │
│                                            ▼                                     │
│                                     ┌───────────┐                                │
│                                     │  EXITED   │                                │
│                                     └───────────┘                                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### UndoState (Stack-Based)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UndoState                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│     Operations: insert_char | delete_char | insert_line |                       │
│                 delete_line | join_lines | split_line                           │
│                                                                                  │
│     ┌──────────────────────────────────────────────────────────┐                │
│     │  undoStack: Operation[]  ◄──── pushUndoOperation()       │                │
│     │  redoStack: Operation[]  ◄──── performUndo/Redo()        │                │
│     │  maxOperations: 100                                      │                │
│     └──────────────────────────────────────────────────────────┘                │
│                                                                                  │
│     Edit Action ──► pushUndoOperation() ──► undoStack.push(), redoStack.clear() │
│                                                                                  │
│     u ────────────► performUndo() ───────► pop undoStack, push redoStack        │
│     Ctrl+R ───────► performRedo() ───────► pop redoStack, push undoStack        │
│                                                                                  │
│     Save ─────────► clearUndoStack() ────► undoStack = [], redoStack = []       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### ClipboardState (Buffer)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ClipboardState                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│     ┌──────────────────────────────────────────────────────────┐                │
│     │  clipboard: string | null                                 │                │
│     │  clipboardType: "line" | "char"                          │                │
│     └──────────────────────────────────────────────────────────┘                │
│                                                                                  │
│     yy ────► yankLine() ────────► store current line in clipboard               │
│     dd ────► deleteLine() ──────► store line, delete from buffer                │
│     p  ────► pasteAfter() ──────► insert clipboard after cursor line            │
│     P  ────► pasteBefore() ─────► insert clipboard before cursor line           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Editor State Interface

```typescript
interface EditorState {
  mode: "normal" | "insert"
  lines: string[]
  cursorLine: number
  cursorCol: number
  isDirty: boolean
  dirtyLines: Set<number>
  filePath: string | null
  isReadOnly: boolean
  isReadOnlyReason: "node_modules" | "git_directory" | "binary_file" | "file_too_large" | null
}
```

---

## 5. FileViewer Composite State Machine

FileViewer combines FileBrowser/TreeBrowser with Document/Editor in a hierarchical state machine.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FILEVIEWER STATE MACHINE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│     ┌──────────┐                                                                │
│     │  BROWSE  │◄──────────────────────────────────────────┐                    │
│     │          │                                           │                    │
│     │ FileBrowser / TreeBrowser                            │                    │
│     └────┬─────┘                                           │                    │
│          │                                                 │                    │
│          │ onOpenFile(path)                                │                    │
│          │ isViewable(path) === true                       │                    │
│          ▼                                                 │                    │
│     ┌──────────┐                                           │                    │
│     │   VIEW   │                                           │                    │
│     │          │                                           │                    │
│     │ Document (embedded, readOnly)                        │                    │
│     │ canEdit = !checkReadOnly()                           │                    │
│     └────┬─────┘                                           │                    │
│          │                                                 │                    │
│          │ "e" key (if canEdit)                            │ q/Escape           │
│          ▼                                                 │                    │
│     ┌──────────┐                                           │                    │
│     │   EDIT   │───────────────────────────────────────────┘                    │
│     │          │                                                                │
│     │ Editor (embedded)                                                         │
│     │ vim keybindings                                                           │
│     └──────────┘                                                                │
│          │                                                                      │
│          │ q/Escape (if !isDirty or confirmed)                                  │
│          ▼                                                                      │
│     ┌──────────┐                                                                │
│     │   VIEW   │ ─── goBackToView() reloads file content                        │
│     └──────────┘                                                                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### FileViewer State Transitions

| Current State | Event | Condition | Next State | Action |
|---------------|-------|-----------|------------|--------|
| BROWSE | onOpenFile(path) | isViewable(path) | VIEW | loadFileContent(), checkReadOnly() |
| BROWSE | onOpenFile(path) | !isViewable(path) | BROWSE | No action (binary/unsupported) |
| VIEW | "e" key | canEdit | EDIT | Switch to Editor component |
| VIEW | q/Escape | - | BROWSE | goBack(), clear docConfig |
| EDIT | q/Escape | !isDirty | VIEW | goBackToView(), reload content |
| EDIT | q/Escape | isDirty | EDIT (confirm) | Show quit confirmation |

### Viewable File Extensions

```typescript
const VIEWABLE_EXTENSIONS = new Set([
  "md", "txt", "json", "yaml", "yml", "toml",
  "ts", "tsx", "js", "jsx", "css", "html", "xml",
  "sh", "bash", "zsh", "py", "rb", "go", "rs",
  "c", "cpp", "h", "hpp", "java", "kt", "swift",
  "sql", "graphql", "env", "gitignore", "dockerignore",
  "editorconfig", "prettierrc", "eslintrc"
])
```

---

## 6. Calendar Canvas State Machine

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CALENDAR STATE MACHINE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  State Variables:                                                               │
│  ─────────────────                                                              │
│  • currentDate: Date (week anchor)                                              │
│  • selectedDay: 0-6 (Mon-Sun)                                                   │
│  • selectedSlot: 0-N (time slots based on granularity)                          │
│                                                                                  │
│     ┌──────────────────────────────────────────────────────────────────┐        │
│     │                        WEEK VIEW                                  │        │
│     │                                                                   │        │
│     │  ←/→  ────► selectedDay ± 1 (clamp 0-6)                          │        │
│     │  ↑/↓  ────► selectedSlot ± 1 (clamp 0-N)                         │        │
│     │  [/]  ────► currentDate ± 7 days (prev/next week)                │        │
│     │  Shift+←/→ ► currentDate ± 7 days                                │        │
│     │  t    ────► currentDate = today, selectedDay = 0, selectedSlot = 0│        │
│     │                                                                   │        │
│     └──────────────────────────────────────────────────────────────────┘        │
│                    │                              │                              │
│                    │ Enter                        │ q/Escape                     │
│                    ▼                              ▼                              │
│            ┌───────────────┐              ┌───────────────┐                      │
│            │   SELECTED    │              │   CANCELLED   │                      │
│            │               │              │               │                      │
│            │ sendSelected({│              │ sendCancelled │                      │
│            │   date,       │              │ renderer.     │                      │
│            │   startTime,  │              │   destroy()   │                      │
│            │   endTime     │              │ onExit()      │                      │
│            │ })            │              │               │                      │
│            └───────────────┘              └───────────────┘                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Calendar Configuration

```typescript
interface CalendarConfig {
  events?: CalendarEvent[]
  initialDate?: string
  startHour?: number      // default: 8
  endHour?: number        // default: 18
  slotGranularity?: number // default: 30 (minutes)
}

interface CalendarEvent {
  id: string
  title: string
  start: string  // ISO datetime
  end: string    // ISO datetime
  color?: string
}

interface SelectedSlot {
  date: string      // ISO date
  startTime: string // HH:MM
  endTime: string   // HH:MM
}
```

---

## 7. Flight Canvas State Machine

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         FLIGHT STATE MACHINE                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  State Variables:                                                               │
│  ─────────────────                                                              │
│  • selectedIndex: number (flight row, 0-indexed)                                │
│  • flights: Flight[] (from config, immutable)                                   │
│                                                                                  │
│     ┌──────────────────────────────────────────────────────────────────┐        │
│     │                       FLIGHT LIST                                 │        │
│     │                                                                   │        │
│     │  ↑  ────► selectedIndex = max(0, selectedIndex - 1)              │        │
│     │  ↓  ────► selectedIndex = min(flights.length - 1, selectedIndex + 1)│     │
│     │                                                                   │        │
│     │  Display: airline, flightNumber, departure, arrival,             │        │
│     │           duration, stops, price                                 │        │
│     │                                                                   │        │
│     └──────────────────────────────────────────────────────────────────┘        │
│                    │                              │                              │
│                    │ Enter                        │ q/Escape                     │
│                    ▼                              ▼                              │
│            ┌───────────────┐              ┌───────────────┐                      │
│            │    BOOKED     │              │   CANCELLED   │                      │
│            │               │              │               │                      │
│            │ sendSelected( │              │ sendCancelled │                      │
│            │   flights[    │              │ renderer.     │                      │
│            │   selectedIdx]│              │   destroy()   │                      │
│            │ )             │              │ onExit()      │                      │
│            └───────────────┘              └───────────────┘                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Flight Configuration

```typescript
interface FlightConfig {
  flights?: Flight[]
  origin?: string
  destination?: string
  date?: string
}

interface Flight {
  id: string
  airline: string
  flightNumber: string
  departure: string   // HH:MM
  arrival: string     // HH:MM
  duration: string    // e.g., "5h30m"
  price: number
  stops: number
  aircraft?: string
}
```

---

## 8. FileBrowser / TreeBrowser State Machine

### FileBrowser (Flat List)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      FILE BROWSER STATE MACHINE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  State Variables:                                                               │
│  ─────────────────                                                              │
│  • currentPath: string                                                          │
│  • entries: FileEntry[]                                                         │
│  • selectedIndex: number                                                        │
│  • loading: boolean                                                             │
│  • error: string | null                                                         │
│  • showHidden: boolean                                                          │
│                                                                                  │
│     ┌──────────────────────────────────────────────────────────────────┐        │
│     │                        BROWSING                                   │        │
│     │                                                                   │        │
│     │  ↑/↓/j/k     ────► selectedIndex ± 1                             │        │
│     │  Enter/→/l   ────► openSelected()                                │        │
│     │  ←/h/Backspace ──► navigateUp() (parent directory)               │        │
│     │  .           ────► toggleHidden(), reload                        │        │
│     │  Ctrl+h      ────► toggleHidden(), reload                        │        │
│     │  ~           ────► loadDirectory($HOME)                          │        │
│     │  r/F5        ────► loadDirectory(currentPath) (refresh)          │        │
│     │  g/Home      ────► selectedIndex = 0                             │        │
│     │  End         ────► selectedIndex = entries.length - 1            │        │
│     │  PgUp/PgDn   ────► selectedIndex ± visibleHeight                 │        │
│     │                                                                   │        │
│     └──────────────────────────────────────────────────────────────────┘        │
│                    │                              │                              │
│                    │ Enter on file                │ q/Escape                     │
│                    ▼                              ▼                              │
│            ┌───────────────┐              ┌───────────────┐                      │
│            │ FILE SELECTED │              │   CANCELLED   │                      │
│            │               │              │               │                      │
│            │ sendSelected  │              │ sendCancelled │                      │
│            │ onOpenFile()  │              │ renderer.     │                      │
│            │               │              │   destroy()   │                      │
│            └───────────────┘              └───────────────┘                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### TreeBrowser (Expandable Tree)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      TREE BROWSER STATE MACHINE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  State Variables:                                                               │
│  ─────────────────                                                              │
│  • rootPath: string                                                             │
│  • tree: TreeNode[] (hierarchical)                                              │
│  • selectedIndex: number (in flattened view)                                    │
│  • loading: boolean                                                             │
│  • showHidden: boolean                                                          │
│                                                                                  │
│  TreeNode:                                                                      │
│  • name, path, isDirectory, size                                                │
│  • depth: number (indentation level)                                            │
│  • expanded: boolean                                                            │
│  • children: TreeNode[]                                                         │
│  • loaded: boolean (lazy loading)                                               │
│                                                                                  │
│     ┌──────────────────────────────────────────────────────────────────┐        │
│     │                        BROWSING                                   │        │
│     │                                                                   │        │
│     │  ↑/↓/j/k     ────► selectedIndex ± 1 (in flat view)              │        │
│     │  Enter/l     ────► openSelected() (expand dir or open file)      │        │
│     │  →           ────► expand folder (if collapsed)                  │        │
│     │  ←/h         ────► collapse folder OR navigate to parent node    │        │
│     │  Backspace   ────► navigateUp() (change rootPath)                │        │
│     │  .           ────► toggleHidden(), reload                        │        │
│     │  ~           ────► setRootPath($HOME), reload                    │        │
│     │  r           ────► loadRoot() (refresh)                          │        │
│     │                                                                   │        │
│     │  Visual: [+] collapsed folder, [-] expanded folder               │        │
│     │          Indentation shows depth                                 │        │
│     │                                                                   │        │
│     └──────────────────────────────────────────────────────────────────┘        │
│                    │                              │                              │
│                    │ Enter on file                │ q/Escape                     │
│                    ▼                              ▼                              │
│            ┌───────────────┐              ┌───────────────┐                      │
│            │ FILE SELECTED │              │   CANCELLED   │                      │
│            └───────────────┘              └───────────────┘                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Tree Expansion Logic

```
toggleExpand(index):
  node = flatNodes[index]
  if !node.isDirectory: return
  
  if !node.loaded:
    node.children = await readDirectory(node.path)
    node.loaded = true
    node.expanded = true
  else:
    node.expanded = !node.expanded
  
  // Flattening happens via flattenTree() memo
```

---

## 9. tmux Spawn State Machine

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         TMUX SPAWN STATE MACHINE                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│     ┌──────────────┐                                                            │
│     │    START     │                                                            │
│     └──────┬───────┘                                                            │
│            │                                                                     │
│            │ detectTerminal()                                                    │
│            ▼                                                                     │
│     ┌──────────────┐         !inTmux          ┌──────────────┐                  │
│     │ CHECK TMUX   │ ────────────────────────►│    ERROR     │                  │
│     └──────┬───────┘                          │ "requires    │                  │
│            │ inTmux                           │  tmux"       │                  │
│            ▼                                  └──────────────┘                  │
│     ┌──────────────┐                                                            │
│     │ ACQUIRE LOCK │◄─────────────────────────────────────┐                     │
│     └──────┬───────┘                                      │                     │
│            │                                              │                     │
│     ┌──────┴──────┐                                       │                     │
│     │             │                                       │                     │
│     ▼ success     ▼ timeout (5s)                          │                     │
│  ┌─────────┐   ┌──────────────┐                           │                     │
│  │ LOCKED  │   │    ERROR     │                           │                     │
│  └────┬────┘   │ "lock failed"│                           │                     │
│       │        └──────────────┘                           │                     │
│       │                                                   │                     │
│       │ getCanvasPaneId()                                 │                     │
│       ▼                                                   │                     │
│  ┌─────────────────┐                                      │                     │
│  │ CHECK EXISTING  │                                      │                     │
│  │     PANE        │                                      │                     │
│  └────────┬────────┘                                      │                     │
│           │                                               │                     │
│    ┌──────┴──────┐                                        │                     │
│    │             │                                        │                     │
│    ▼ exists      ▼ not exists                             │                     │
│ ┌─────────┐   ┌─────────────┐                             │                     │
│ │  REUSE  │   │ CREATE NEW  │                             │                     │
│ │  PANE   │   │    PANE     │                             │                     │
│ │         │   │             │                             │                     │
│ │ send-   │   │ split-      │                             │                     │
│ │ keys    │   │ window -h   │                             │                     │
│ │ C-c     │   │ -p 67       │                             │                     │
│ │ clear   │   │             │                             │                     │
│ │ command │   │             │                             │                     │
│ └────┬────┘   └──────┬──────┘                             │                     │
│      │               │                                    │                     │
│      │               │ saveCanvasPaneId()                 │                     │
│      └───────┬───────┘                                    │                     │
│              │                                            │                     │
│              ▼                                            │                     │
│     ┌──────────────┐                                      │                     │
│     │ RELEASE LOCK │──────────────────────────────────────┘                     │
│     └──────┬───────┘     (on error, also release)                               │
│            │                                                                     │
│            ▼                                                                     │
│     ┌──────────────┐                                                            │
│     │   SUCCESS    │                                                            │
│     │ method:      │                                                            │
│     │ tmux-reuse   │                                                            │
│     │ tmux-split   │                                                            │
│     └──────────────┘                                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Lock Management

```typescript
// Lock file format: "{pid}:{timestamp}"
const CANVAS_LOCK_FILE = "/tmp/opencode-canvas-pane.lock"
const LOCK_TIMEOUT_MS = 5000   // Max wait to acquire lock
const LOCK_STALE_MS = 30000    // Lock considered stale after 30s

async function isLockStale(): Promise<boolean> {
  // Lock is stale if:
  // 1. File doesn't exist
  // 2. Invalid format
  // 3. Timestamp > 30s old
  // 4. PID no longer running
}

async function acquireLock(): Promise<boolean> {
  // Retry loop with 50ms intervals
  // Write "{pid}:{timestamp}" atomically
  // Verify we own the lock after write
}

async function releaseLock(): Promise<void> {
  // Only delete if we own the lock (check PID)
}
```

### Pane Reuse vs Creation

| Scenario | Action | tmux Command |
|----------|--------|--------------|
| No existing pane | Create new | `split-window -h -p 67 -P -F "#{pane_id}" {command}` |
| Existing pane valid | Reuse | `send-keys -t {paneId} C-c` then `send-keys -t {paneId} "clear && {command}" Enter` |
| Existing pane invalid | Create new | (same as no existing pane) |

---

## 10. Summary of State Patterns

| Component | State Pattern | Key States | Complexity |
|-----------|---------------|------------|------------|
| **All Canvases** | Lifecycle FSM | INIT → READY → NAVIGATING ↔ SELECTING → COMPLETED/CANCELLED | Low |
| **Editor** | Composite FSM | EditorMode × SaveState × QuitState × UndoState × ClipboardState | High |
| **FileViewer** | Hierarchical FSM | BROWSE ↔ VIEW ↔ EDIT | Medium |
| **Calendar** | Simple FSM | Week navigation + Time slot selection | Low |
| **Flight** | Simple FSM | List navigation + Selection | Low |
| **FileBrowser** | Simple FSM | Directory navigation + File selection | Low |
| **TreeBrowser** | Simple FSM + Tree | Directory navigation + Expand/Collapse + File selection | Medium |
| **IPC** | Request/Response | Canvas ↔ Controller message protocol | Low |
| **tmux Spawn** | Sequential FSM | Lock → Check → Reuse/Create → Release | Medium |

### State Management Patterns Used

1. **SolidJS Signals**: All components use `createSignal()` for reactive state
2. **Memoization**: `createMemo()` for derived state (e.g., `flatNodes`, `wrappedLines`)
3. **Orthogonal State Machines**: Editor uses multiple independent state machines that compose
4. **Stack-Based State**: Undo/Redo uses operation stacks
5. **Hierarchical States**: FileViewer nests FileBrowser/Document/Editor states

### Key Design Decisions

1. **No External State Library**: Pure SolidJS signals, no Redux/MobX
2. **Functional State Updates**: All state transitions are pure functions
3. **Separation of Concerns**: Each state machine in its own file (e.g., `editor-save.ts`, `editor-quit.ts`)
4. **IPC Abstraction**: `useIPCServer()` hook encapsulates all socket communication
5. **Lazy Loading**: TreeBrowser loads children on-demand when expanding folders
