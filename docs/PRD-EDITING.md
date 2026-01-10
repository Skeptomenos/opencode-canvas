# PRD: Document Editing Feature

**Status**: Draft
**Author**: OpenCode Canvas Team
**Date**: January 2025

---

## Overview

Add vim-style editing capabilities to the document canvas, enabling users to edit text files directly within the terminal file browser.

## Goals

1. Enable in-place editing of text files without leaving the canvas
2. Provide familiar vim-style modal editing (normal/insert modes)
3. Support essential editing operations: insert, delete, copy, paste, undo
4. Ensure data safety with manual save, confirmation, and backups

## Non-Goals

- Syntax-aware editing (auto-indent, bracket matching)
- Multiple cursors
- Find and replace
- Split views / multiple files
- LSP integration

---

## User Stories

### US-1: Basic Editing

As a user, I want to edit a file I'm viewing so that I can make quick changes without opening another editor.

### US-2: Vim Navigation

As a vim user, I want familiar keybindings so that I can edit efficiently.

### US-3: Safe Saving

As a user, I want confirmation before overwriting and automatic backups so that I don't lose data.

### US-4: Unsaved Changes Warning

As a user, I want to be warned about unsaved changes when exiting so that I don't accidentally lose work.

---

## Functional Requirements

### FR-1: File Types

| Requirement | Description                                                            |
| ----------- | ---------------------------------------------------------------------- |
| FR-1.1      | All text-based files are editable                                      |
| FR-1.2      | Binary files are view-only (detected by null bytes or extension)       |
| FR-1.3      | Files in node_modules are view-only                                    |
| FR-1.4      | Read-only files (no write permission) show warning, allow viewing only |
| FR-1.5      | Maximum editable file size: 1MB (larger files are view-only)           |

### FR-2: Entry Points

| Requirement | Description                                                                           |
| ----------- | ------------------------------------------------------------------------------------- |
| FR-2.1      | Editing works in flat browser mode                                                    |
| FR-2.2      | Editing works in tree browser mode                                                    |
| FR-2.3      | Editing works with `--file` flag: `bun run src/cli.ts show document --file README.md` |
| FR-2.4      | New flag `--edit` to open directly in edit mode                                       |

### FR-3: Modal Editing (Vim-Style)

#### FR-3.1: Normal Mode (Default)

| Key       | Action                                       |
| --------- | -------------------------------------------- |
| `i`       | Enter insert mode at cursor                  |
| `a`       | Enter insert mode after cursor               |
| `o`       | Insert new line below, enter insert mode     |
| `O`       | Insert new line above, enter insert mode     |
| `A`       | Move to end of line, enter insert mode       |
| `I`       | Move to start of line, enter insert mode     |
| `x`       | Delete character under cursor                |
| `dd`      | Delete current line                          |
| `yy`      | Yank (copy) current line                     |
| `p`       | Paste after cursor                           |
| `P`       | Paste before cursor                          |
| `u`       | Undo last change                             |
| `Ctrl+R`  | Redo                                         |
| `h/j/k/l` | Navigate left/down/up/right                  |
| `0`       | Move to start of line                        |
| `$`       | Move to end of line                          |
| `gg`      | Move to first line                           |
| `G`       | Move to last line                            |
| `w`       | Move to next word                            |
| `b`       | Move to previous word                        |
| `:w`      | Save file                                    |
| `:q`      | Quit (prompts if unsaved changes)            |
| `:wq`     | Save and quit                                |
| `:q!`     | Quit without saving (discard changes)        |
| `Escape`  | Stay in normal mode / cancel pending command |

#### FR-3.2: Insert Mode

| Key                     | Action                          |
| ----------------------- | ------------------------------- |
| Any printable character | Insert at cursor position       |
| `Enter`                 | Insert new line                 |
| `Backspace`             | Delete character before cursor  |
| `Delete`                | Delete character at cursor      |
| `Arrow keys`            | Navigate (stay in insert mode)  |
| `Escape`                | Return to normal mode           |
| `Ctrl+S`                | Save file (stay in insert mode) |

#### FR-3.3: Visual Mode (Optional - Phase 2)

| Key      | Action                                  |
| -------- | --------------------------------------- |
| `v`      | Enter visual mode (character selection) |
| `V`      | Enter visual line mode (line selection) |
| `y`      | Yank selection                          |
| `d`      | Delete selection                        |
| `Escape` | Exit visual mode                        |

### FR-4: Clipboard Operations

| Requirement | Description                                      |
| ----------- | ------------------------------------------------ |
| FR-4.1      | Internal clipboard for yank/paste operations     |
| FR-4.2      | `yy` copies current line to clipboard            |
| FR-4.3      | `dd` cuts current line to clipboard              |
| FR-4.4      | `p` pastes clipboard content                     |
| FR-4.5      | Clipboard persists during session (lost on exit) |

### FR-5: Undo/Redo

| Requirement | Description                                                           |
| ----------- | --------------------------------------------------------------------- |
| FR-5.1      | Undo stack stores up to 100 operations                                |
| FR-5.2      | Each operation is atomic (single character insert, line delete, etc.) |
| FR-5.3      | Undo with `u` in normal mode                                          |
| FR-5.4      | Redo with `Ctrl+R` in normal mode                                     |
| FR-5.5      | Undo stack is cleared on save                                         |

### FR-6: Saving

| Requirement | Description                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| FR-6.1      | Manual save only (no auto-save)                                             |
| FR-6.2      | Save with `:w` or `Ctrl+S`                                                  |
| FR-6.3      | Confirmation dialog before overwriting: "Save changes to {filename}? [y/n]" |
| FR-6.4      | Create backup before saving: `{filename}.bak`                               |
| FR-6.5      | Backup is overwritten on each save (single backup only)                     |
| FR-6.6      | Show "Saved" confirmation message for 2 seconds                             |

### FR-7: Unsaved Changes

| Requirement | Description                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------- |
| FR-7.1      | Track modified state (dirty flag)                                                           |
| FR-7.2      | Show `*` in title bar when file has unsaved changes                                         |
| FR-7.3      | On quit with unsaved changes, show prompt: "Unsaved changes. Save before quitting? [y/n/c]" |
| FR-7.4      | `y` = save and quit, `n` = quit without saving, `c` = cancel (stay in editor)               |

### FR-8: Visual Indicators

| Requirement | Description                                                                      |
| ----------- | -------------------------------------------------------------------------------- |
| FR-8.1      | Mode indicator in status bar: `-- NORMAL --`, `-- INSERT --`, `-- VISUAL --`     |
| FR-8.2      | Different cursor style per mode (if terminal supports)                           |
| FR-8.3      | Status bar shows: mode, filename, modified indicator, cursor position (line:col) |
| FR-8.4      | Status bar color: normal=gray, insert=green, visual=yellow                       |

### FR-9: Restrictions

| Requirement | Description                                               |
| ----------- | --------------------------------------------------------- |
| FR-9.1      | Files in `node_modules/` are read-only                    |
| FR-9.2      | Files in `.git/` are read-only                            |
| FR-9.3      | Binary files are read-only (show "Binary file" message)   |
| FR-9.4      | Files > 1MB are read-only (show "File too large" message) |
| FR-9.5      | Files without write permission show "Read-only" indicator |

---

## Technical Design

### TD-1: State Management

```typescript
interface EditorState {
  mode: "normal" | "insert" | "visual"
  lines: string[]
  cursorLine: number
  cursorCol: number
  selectionStart: { line: number; col: number } | null
  selectionEnd: { line: number; col: number } | null
  clipboard: string[]
  undoStack: EditorOperation[]
  redoStack: EditorOperation[]
  isDirty: boolean
  originalContent: string
  filePath: string
  isReadOnly: boolean
  readOnlyReason: string | null
}

interface EditorOperation {
  type: "insert" | "delete" | "replace"
  position: { line: number; col: number }
  text: string
  previousText?: string
}
```

### TD-2: File Structure

```
src/canvases/
├── editor/
│   ├── editor.tsx           # Main editor component
│   ├── editor-state.ts      # State management
│   ├── editor-commands.ts   # Vim command handlers
│   ├── editor-clipboard.ts  # Clipboard operations
│   ├── editor-undo.ts       # Undo/redo stack
│   ├── editor-save.ts       # Save/backup logic
│   └── editor-utils.ts      # Helper functions
├── document.tsx             # Updated to support edit mode
└── ...
```

### TD-3: Integration Points

1. **document.tsx**: Add `editable` prop, integrate editor component
2. **file-viewer.tsx**: Pass `editable=true` when opening files
3. **tree-file-viewer.tsx**: Pass `editable=true` when opening files
4. **cli.ts**: Add `--edit` flag to `show document` command

---

## UI Mockups

### Normal Mode

```
┌─ README.md *                                          Line 5/120 Col 12 ─┐
│   1 # OpenCode Canvas                                                     │
│   2                                                                       │
│   3 Interactive terminal canvases for OpenCode.                           │
│   4                                                                       │
│ > 5 - OpenCode: https://github.com/sst/opencode                          │
│   6 - claude-canvas: https://github.com/dvdsgl/claude-canvas              │
│   7                                                                       │
├───────────────────────────────────────────────────────────────────────────┤
│ -- NORMAL --                                           :w to save  q quit │
└───────────────────────────────────────────────────────────────────────────┘
```

### Insert Mode

```
┌─ README.md *                                          Line 5/120 Col 15 ─┐
│   1 # OpenCode Canvas                                                     │
│   2                                                                       │
│   3 Interactive terminal canvases for OpenCode.                           │
│   4                                                                       │
│ > 5 - OpenCode: https://github.com/sst/opencode|                         │
│   6 - claude-canvas: https://github.com/dvdsgl/claude-canvas              │
│   7                                                                       │
├───────────────────────────────────────────────────────────────────────────┤
│ -- INSERT --                                        Ctrl+S save  Esc exit │
└───────────────────────────────────────────────────────────────────────────┘
```

### Save Confirmation

```
┌─ README.md *                                          Line 5/120 Col 12 ─┐
│   ...                                                                     │
├───────────────────────────────────────────────────────────────────────────┤
│ Save changes to README.md? [y/n]                                          │
└───────────────────────────────────────────────────────────────────────────┘
```

### Quit with Unsaved Changes

```
┌─ README.md *                                          Line 5/120 Col 12 ─┐
│   ...                                                                     │
├───────────────────────────────────────────────────────────────────────────┤
│ Unsaved changes. Save before quitting? [y]es [n]o [c]ancel                │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Editing (MVP)

- Normal mode navigation (h/j/k/l, gg, G, 0, $)
- Insert mode (i, a, Escape)
- Basic editing (insert characters, backspace, delete, enter)
- Save with confirmation and backup (:w, Ctrl+S)
- Quit with unsaved changes prompt (:q, :wq, :q!)
- Mode indicator and dirty flag

**Estimate**: 8-12 hours

### Phase 2: Extended Editing

- Line operations (dd, yy, o, O)
- Clipboard (p, P)
- Undo/redo (u, Ctrl+R)
- Word navigation (w, b)
- More insert commands (A, I)

**Estimate**: 6-8 hours

### Phase 3: Visual Mode

- Character selection (v)
- Line selection (V)
- Yank/delete selection

**Estimate**: 4-6 hours

### Phase 4: Polish

- Read-only detection and messaging
- File size limits
- node_modules/git restrictions
- Error handling improvements

**Estimate**: 3-4 hours

---

## Success Metrics

1. User can edit and save a file without errors
2. Undo/redo works correctly for all operations
3. No data loss (backup always created before save)
4. Unsaved changes are never silently discarded

---

## Open Questions

1. Should we support `.editorconfig` for indent settings?
2. Should visual mode be included in MVP or deferred?
3. Should we add a `--readonly` flag to force view-only mode?

---

## Appendix: Vim Command Reference

For reference, here are the vim commands we're implementing:

| Command   | Mode | Description             |
| --------- | ---- | ----------------------- |
| `i`       | N→I  | Insert before cursor    |
| `a`       | N→I  | Insert after cursor     |
| `o`       | N→I  | Open line below         |
| `O`       | N→I  | Open line above         |
| `A`       | N→I  | Append at end of line   |
| `I`       | N→I  | Insert at start of line |
| `Escape`  | I→N  | Return to normal mode   |
| `h/j/k/l` | N    | Navigate                |
| `0`       | N    | Start of line           |
| `$`       | N    | End of line             |
| `gg`      | N    | First line              |
| `G`       | N    | Last line               |
| `w`       | N    | Next word               |
| `b`       | N    | Previous word           |
| `x`       | N    | Delete char             |
| `dd`      | N    | Delete line             |
| `yy`      | N    | Yank line               |
| `p`       | N    | Paste after             |
| `P`       | N    | Paste before            |
| `u`       | N    | Undo                    |
| `Ctrl+R`  | N    | Redo                    |
| `:w`      | N    | Save                    |
| `:q`      | N    | Quit                    |
| `:wq`     | N    | Save and quit           |
| `:q!`     | N    | Force quit              |
