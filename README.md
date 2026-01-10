# OpenCode Canvas

Interactive terminal canvases for OpenCode. A port of [claude-canvas](https://github.com/dvdsgl/claude-canvas) from React/Ink to SolidJS/OpenTUI.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ tmux: opencode                                                            ─ □ x │
├─────────────────────────────────────┬───────────────────────────────────────────┤
│  OpenCode TUI                       │  Calendar Canvas                          │
│                                     │                                           │
│  > Implement auth module            │  ◀ January 2026 ▶                         │
│                                     │                                           │
│  ┌─────────────────────────────┐    │  Mon   Tue   Wed   Thu   Fri   Sat   Sun  │
│  │ I'll help implement the    │    │  ───────────────────────────────────────  │
│  │ authentication module.     │    │                1     2     3     4     5  │
│  │                            │    │   6     7     8    [9]   10    11    12  │
│  │ First, let me spawn a      │    │  13    14    15    16    17    18    19  │
│  │ calendar to pick a time    │    │  20    21    22    23    24    25    26  │
│  │ for the review meeting...  │    │  27    28    29    30    31              │
│  │                            │    │                                           │
│  │ ████████████░░░░░░░░░░░░░  │    │  ┌─────────────────────────────────────┐  │
│  │ Spawning calendar...       │    │  │ 09:00  Team Standup                 │  │
│  └─────────────────────────────┘    │  │ 10:30  ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  │
│                                     │  │ 11:00  ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  │
│  [?] Help  [q] Quit                 │  │ 14:00  Code Review                  │  │
│                                     │  └─────────────────────────────────────┘  │
│                                     │                                           │
│                                     │  [←/→] Week  [↑/↓] Select  [Enter] Pick   │
├─────────────────────────────────────┴───────────────────────────────────────────┤
│ IPC: /tmp/canvas-calendar-1.sock                              ← Unix Socket →  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Overview

TUI toolkit providing interactive terminal canvases (calendar, document, flight) spawned via tmux split panes. Designed for seamless integration with OpenCode's AI-assisted development workflow.

## Features

- **Calendar Canvas** - View calendars, pick meeting times with keyboard navigation
- **Document Canvas** - View/edit markdown documents with scroll and selection
- **Flight Canvas** - Compare flights and select seats (booking interface)
- **IPC System** - Unix socket communication between canvases and controllers
- **tmux Integration** - Spawn canvases in split panes, reuse existing panes

## Requirements

- [Bun](https://bun.sh) >= 1.0
- tmux (for spawning canvases in split panes)

## Installation

```bash
bun install
```

## Usage

```bash
# Show canvas in current terminal
bun run src/cli.ts show calendar
bun run src/cli.ts show document --config '{"content": "# Hello World"}'

# Spawn canvas in tmux split pane
bun run src/cli.ts spawn calendar --scenario meeting-picker

# Check terminal environment
bun run src/cli.ts env
```

## Development

```bash
# Type checking
bun run typecheck

# Run tests
bun test

# Build for production
bun run build
```

## Architecture

```
src/
├── cli.ts           # CLI entry point (show/spawn/env commands)
├── terminal.ts      # tmux detection and pane spawning
├── canvases/        # Canvas components (calendar, document, flight)
├── ipc/             # Unix socket IPC (server, client, types)
└── api/             # High-level programmatic API

skills/              # OpenCode skill definitions
```

## IPC Protocol

Canvases communicate via Unix sockets at `/tmp/canvas-{id}.sock`

**Canvas → Controller:**

- `ready` - Canvas initialized
- `selected` - User made a selection
- `cancelled` - User cancelled
- `error` - Error occurred

**Controller → Canvas:**

- `update` - Update canvas configuration
- `close` - Close the canvas
- `ping` / `pong` - Health check
- `getSelection` / `getContent` - Query canvas state

## Tech Stack

- **Runtime**: Bun
- **UI Framework**: SolidJS + @opentui/solid
- **CLI**: Commander.js
- **IPC**: Unix domain sockets (Bun.listen/Bun.connect)

## License

MIT
