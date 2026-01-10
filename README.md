# OpenCode Canvas

Interactive terminal canvases for OpenCode. Inspired by claude-canvas, ported from React/Ink to SolidJS/OpenTUI.

- OpenCode: https://github.com/sst/opencode
- claude-canvas: https://github.com/dvdsgl/claude-canvas

**Disclaimer**: This is an independent project. I am not affiliated with, endorsed by, or connected to either the OpenCode or claude-canvas projects.

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

## Features

- **File Browser** - Browse directories with flat list or tree view. Navigate folders, open files to view with markdown rendering.
- **Tree View** - Expand/collapse folders inline. See your project structure at a glance.
- **Markdown Viewer** - View markdown files with syntax highlighting for headers, bold, italic, code, links, lists, and tables.
- **Vim-Style Editor** - Full-featured text editor with vim keybindings:
  - **Navigation**: h/j/k/l, arrow keys, w/b (word), 0/$ (line), gg/G (file)
  - **Editing**: i/a/o/O (insert modes), x (delete char), dd (delete line)
  - **Clipboard**: yy (yank), p/P (paste after/before)
  - **Undo/Redo**: u (undo), Ctrl+R (redo) with 100-operation history
  - **Commands**: :w (save), :q (quit), :wq (save+quit), :q! (force quit)
  - **Visual Feedback**: Dirty lines highlighted in green until saved
  - **Mouse Support**: Click to position cursor, scroll with mouse/touchpad
  - **Safety**: Auto-backup before save, unsaved changes warning on quit
  - **Read-only Protection**: node_modules, .git, binary files, >1MB files
- **Calendar Canvas** - Week view calendar with time slot selection for meeting scheduling.
- **Flight Canvas** - Compare flight options in a table format.
- **IPC System** - Unix socket communication for programmatic control.
- **tmux Integration** - Spawn canvases in split panes (optional).

## Requirements

- Bun >= 1.0 (https://bun.sh)
- tmux (optional, for split pane spawning)

## Installation

```bash
git clone https://github.com/Skeptomenos/opencode-canvas.git
cd opencode-canvas
bun install
```

## Quick Start

### Browse Files (Most Common Use)

```bash
# Browse current directory (flat list)
bun run src/cli.ts browse

# Browse with tree view (expand/collapse folders)
bun run src/cli.ts browse --tree

# Browse a specific path
bun run src/cli.ts browse ~/Projects
bun run src/cli.ts browse /path/to/folder

# Show hidden files
bun run src/cli.ts browse --hidden
bun run src/cli.ts browse --tree --hidden
```

### File Browser Controls

Flat view:

- Up/Down or j/k - Navigate
- Enter or Right - Open file or enter folder
- Left or Backspace - Go to parent directory
- Period - Toggle hidden files
- Tilde - Go to home directory
- q - Quit

Tree view:

- Up/Down - Navigate
- Enter - Expand folder or open file
- Right - Expand folder
- Left - Collapse folder or go to parent
- Backspace - Go up one directory level
- Period - Toggle hidden files
- q - Quit

When viewing a file, press q or Escape to return to the browser.

### Edit a File

```bash
# Open file directly in edit mode
bun run src/cli.ts show document --file README.md --edit

# Or from the file browser, files open in edit mode by default
bun run src/cli.ts browse
```

Editor Controls (Normal Mode):

- h/l or Left/Right - Move cursor left/right
- j/k or Up/Down - Move cursor up/down
- w/b - Move by word
- 0/$ - Start/end of line
- gg/G - First/last line
- i/a - Enter insert mode (before/after cursor)
- o/O - Open line below/above
- x - Delete character
- dd - Delete line
- yy - Yank (copy) line
- p/P - Paste after/before
- u - Undo
- Ctrl+R - Redo
- :w - Save
- :q - Quit
- :wq - Save and quit
- :q! - Quit without saving

Editor Controls (Insert Mode):

- Type to insert text
- Backspace - Delete character before cursor
- Enter - New line
- Arrow keys - Navigate
- Escape - Return to normal mode
- Ctrl+S - Save

Mouse/Touchpad:

- Click anywhere to position cursor
- Scroll with mouse wheel or touchpad gestures

Visual Feedback:

- Modified lines are highlighted in green until saved
- Status bar shows mode, filename, dirty indicator (*), and cursor position
- Title bar shows * when file has unsaved changes

Read-only files (node_modules, .git, binary, >1MB) show a warning and cannot be edited.

### View a Single File

```bash
bun run src/cli.ts show document --file README.md
bun run src/cli.ts show document --file ~/notes.md
```

### Calendar Canvas

```bash
bun run src/cli.ts show calendar
```

Controls:

- Left/Right - Previous/next week
- Up/Down - Select time slot
- t - Jump to today
- Enter - Confirm selection
- q - Quit

### Flight Canvas

```bash
bun run src/cli.ts show flight --config '{"origin":"SFO","destination":"JFK","flights":[{"id":"1","airline":"United","flightNumber":"UA123","departure":"08:00","arrival":"16:30","duration":"5h30m","price":450,"stops":0}]}'
```

Controls:

- Up/Down - Select flight
- Enter - Book selected
- q - Quit

### Spawn in tmux

If running inside tmux, spawn canvases in a split pane:

```bash
bun run src/cli.ts spawn calendar
bun run src/cli.ts env  # Check if in tmux
```

## Programmatic API

```typescript
import { pickMeetingTime, viewDocument, bookFlight } from "./src/api"

// Pick a meeting time
const meeting = await pickMeetingTime({
  events: [{ id: "1", title: "Standup", start: "2025-01-10T09:00", end: "2025-01-10T09:30" }],
  slotGranularity: 30,
})

if (meeting.success) {
  console.log("Selected:", meeting.data.startTime)
}

// View a document
const doc = await viewDocument({
  content: "# Hello\n\nThis is **markdown** content.",
  title: "My Doc",
})

// Book a flight
const flight = await bookFlight({
  origin: "SFO",
  destination: "JFK",
  flights: [
    {
      id: "1",
      airline: "United",
      flightNumber: "UA123",
      departure: "08:00",
      arrival: "16:30",
      duration: "5h30m",
      price: 450,
      stops: 0,
    },
  ],
})
```

## Markdown Rendering

The document viewer renders markdown with:

- Headers (h1-h4) in cyan/teal with bold
- Bold text
- Italic text
- Inline code in orange
- Links in blue
- Block quotes with gray bar
- Bullet and numbered lists
- Tables with parsed cell content
- Code blocks in orange
- Horizontal rules

## Development

```bash
bun run typecheck    # Type checking
bun test             # Run tests (6 tests)
bun run format       # Format code
bun run lint         # Format + typecheck
```

## Architecture

```
src/
├── cli.ts                    # CLI (show, spawn, browse, env)
├── terminal.ts               # tmux spawning with lock management
├── canvases/
│   ├── browser.tsx           # Flat file browser
│   ├── tree-browser.tsx      # Tree view file browser
│   ├── file-viewer.tsx       # Browser + document viewer
│   ├── tree-file-viewer.tsx  # Tree browser + document viewer
│   ├── document.tsx          # Markdown document viewer
│   ├── markdown-renderer.tsx # Markdown parsing and rendering
│   ├── calendar.tsx          # Calendar week view
│   ├── flight.tsx            # Flight comparison
│   └── editor/               # Vim-style text editor
│       ├── editor.tsx        # Main editor component
│       ├── editor-state.ts   # State management
│       ├── editor-navigation.ts # Cursor movement
│       ├── editor-insert.ts  # Insert mode operations
│       ├── editor-clipboard.ts # Yank/paste
│       ├── editor-undo.ts    # Undo/redo stack
│       ├── editor-save.ts    # Save with backup
│       ├── editor-quit.ts    # Quit with unsaved warning
│       ├── editor-command.ts # :w/:q command parsing
│       └── editor-readonly.ts # Read-only detection
├── ipc/                      # Unix socket IPC
└── api/                      # Programmatic API
```

## IPC Protocol

Canvases communicate via Unix sockets at /tmp/canvas-{id}.sock

Canvas to Controller: ready, selected, cancelled, error
Controller to Canvas: update, close, ping, getSelection, getContent

## Tech Stack

- Runtime: Bun
- UI: SolidJS + @opentui/solid
- CLI: Commander.js
- IPC: Unix domain sockets

## Credits

- Inspired by claude-canvas (https://github.com/dvdsgl/claude-canvas) by David Siegel
- Built for OpenCode (https://github.com/sst/opencode) by SST
- Uses OpenTUI (https://github.com/sst/opentui)

## License

MIT
