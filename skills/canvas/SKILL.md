---
name: canvas
description: Terminal TUI toolkit for interactive canvases. Spawn calendars, documents, or flight booking interfaces in tmux split panes.
keywords: [canvas, tui, terminal, tmux, interactive, opencode]
---

# Canvas TUI Toolkit

Interactive terminal canvases for OpenCode. Spawn visual interfaces (calendar, document, flight) in tmux split panes with full keyboard navigation and IPC communication.

## Overview

Canvases are TUI components that:

- Render in tmux split panes alongside OpenCode
- Communicate via Unix sockets (IPC)
- Support keyboard navigation
- Return structured data on selection/cancellation

## Quick Start

```bash
# Show canvas in current terminal
bun run src/cli.ts show calendar

# Spawn in tmux split (interactive)
bun run src/cli.ts spawn calendar --scenario meeting-picker

# With configuration
bun run src/cli.ts spawn document --config '{"content": "# Hello World"}'
```

## Canvas Types

| Canvas   | Scenarios                    | Purpose                             |
| -------- | ---------------------------- | ----------------------------------- |
| calendar | display, meeting-picker      | View calendars, pick meeting times  |
| document | display, edit, email-preview | View/edit markdown content          |
| flight   | booking                      | Compare flights, select for booking |
| files    | browse                       | Browse directories, open files      |

## CLI Commands

### `show [kind]`

Render canvas in current terminal (blocking).

```bash
bun run src/cli.ts show calendar --id my-cal --config '{"events": [...]}'
```

Options:

- `--id <id>` - Canvas identifier
- `--config <json>` - Configuration JSON
- `--socket <path>` - Unix socket path for IPC
- `--scenario <name>` - Scenario mode

### `spawn [kind]`

Spawn canvas in tmux split pane (non-blocking).

```bash
bun run src/cli.ts spawn calendar --scenario meeting-picker
```

### `browse [path]`

Browse files and directories with keyboard navigation. Open files to view content.

```bash
bun run src/cli.ts browse              # Browse current directory
bun run src/cli.ts browse ~/Documents  # Browse specific path
bun run src/cli.ts browse --hidden     # Show hidden files
```

Keyboard:

- `↑`/`↓` or `j`/`k` - Navigate
- `Enter`/`→`/`l` - Open file or enter directory
- `←`/`h`/`Backspace` - Go up to parent directory
- `.` or `Ctrl+H` - Toggle hidden files
- `~` - Go to home directory
- `q` - Quit

### `env`

Show detected terminal environment.

```bash
bun run src/cli.ts env
# Output: In tmux: true
```

## Programmatic API

```typescript
import { pickMeetingTime, editDocument, bookFlight } from "./src/api"

// Pick a meeting time
const result = await pickMeetingTime({
  events: [{ id: "1", title: "Standup", start: "2025-01-10T09:00", end: "2025-01-10T09:30" }],
  slotGranularity: 30,
})

if (result.success && result.data) {
  console.log(`Selected: ${result.data.startTime}`)
}

// Edit a document
const docResult = await editDocument({
  content: "# My Document\n\nEdit this content...",
  title: "Notes",
})

// Book a flight
const flightResult = await bookFlight({
  flights: [
    {
      id: "1",
      airline: "United",
      flightNumber: "UA123",
      departure: "08:00",
      arrival: "11:30",
      duration: "3h30m",
      price: 450,
      stops: 0,
    },
  ],
  origin: "SFO",
  destination: "JFK",
})
```

## IPC Protocol

Canvases communicate via Unix sockets at `/tmp/canvas-{id}.sock`

### Canvas → Controller Messages

| Type        | Description         | Data                                       |
| ----------- | ------------------- | ------------------------------------------ |
| `ready`     | Canvas initialized  | `{ scenario: string }`                     |
| `selected`  | User made selection | Selection data                             |
| `cancelled` | User cancelled      | `{ reason?: string }`                      |
| `error`     | Error occurred      | `{ message: string }`                      |
| `pong`      | Response to ping    | -                                          |
| `selection` | Text selection data | `{ selectedText, startOffset, endOffset }` |
| `content`   | Document content    | `{ content, cursorPosition }`              |

### Controller → Canvas Messages

| Type           | Description          | Data                  |
| -------------- | -------------------- | --------------------- |
| `update`       | Update configuration | `{ config: unknown }` |
| `close`        | Close the canvas     | -                     |
| `ping`         | Health check         | -                     |
| `getSelection` | Request selection    | -                     |
| `getContent`   | Request content      | -                     |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ tmux session                                                    │
├─────────────────────────────┬───────────────────────────────────┤
│  OpenCode TUI               │  Canvas (calendar/document/flight)│
│                             │                                   │
│  Controller                 │  IPC Server                       │
│  └── IPC Client ──────────────► Unix Socket                     │
│                             │  /tmp/canvas-{id}.sock            │
└─────────────────────────────┴───────────────────────────────────┘
```

## Requirements

- **Bun** >= 1.0
- **tmux** (for spawn command)

## See Also

- [Calendar Canvas](../calendar/SKILL.md) - Calendar-specific usage
- [Document Canvas](../document/SKILL.md) - Document-specific usage
- [Flight Canvas](../flight/SKILL.md) - Flight-specific usage
- [File Browser](../files/SKILL.md) - File browser usage
