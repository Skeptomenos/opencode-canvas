---
name: document
description: Terminal markdown editor with preview, scroll, and selection tracking
keywords: [markdown, editor, document, email-preview, text]
---

# Document Canvas

Terminal-based document viewer and editor with markdown rendering, scroll support, and text selection tracking.

## Overview

The document canvas provides:

- Markdown content display with basic formatting
- Scroll navigation for long documents
- Text editing with cursor tracking
- Selection tracking for AI-assisted editing
- Email preview mode with headers

## Quick Start

```bash
# Show document in current terminal
bun run src/cli.ts show document --config '{"content": "# Hello World\n\nThis is markdown."}'

# Spawn editable document in tmux split
bun run src/cli.ts spawn document --scenario edit --config '{
  "content": "# My Document\n\nEdit this content...",
  "title": "Notes"
}'

# Email preview mode
bun run src/cli.ts show document --scenario email-preview --config '{
  "content": "Meeting confirmed for tomorrow.",
  "emailHeaders": {
    "from": "alice@example.com",
    "to": "bob@example.com",
    "subject": "Meeting Confirmation",
    "date": "2025-01-10"
  }
}'
```

## Scenarios

### `display`

Read-only document view. Scroll navigation, no editing.

```bash
bun run src/cli.ts show document --scenario display
```

### `edit`

Editable document. Character input, cursor movement, save on Ctrl+S.

```bash
bun run src/cli.ts spawn document --scenario edit
```

### `email-preview`

Email display with headers (From, To, Subject, Date).

```bash
bun run src/cli.ts show document --scenario email-preview
```

## API Usage

### Edit Document

```typescript
import { editDocument } from "./src/api"

const result = await editDocument({
  content: "# Project Notes\n\nAdd your notes here...",
  title: "Project Notes",
})

if (result.success && !result.cancelled) {
  console.log("Selected text:", result.data.selectedText)
  console.log("Selection range:", result.data.startOffset, "-", result.data.endOffset)
}
```

### View Document

```typescript
import { viewDocument } from "./src/api"

const result = await viewDocument({
  content: "# README\n\nThis is a read-only document.",
  title: "README",
  readOnly: true,
})

// User closed the document
if (result.success) {
  console.log("Document closed")
}
```

## Keyboard Shortcuts

| Key           | Action                       |
| ------------- | ---------------------------- |
| `↑` / `k`     | Scroll up                    |
| `↓` / `j`     | Scroll down                  |
| `Ctrl+S`      | Save / Confirm (edit mode)   |
| `q` / `Esc`   | Quit / Cancel                |
| Any character | Insert text (edit mode)      |
| `Backspace`   | Delete character (edit mode) |

## Configuration

### DocumentConfig

```typescript
interface DocumentConfig {
  content?: string // Document content
  title?: string // Document title
  format?: "markdown" | "plain" | "email" // Content format
  readOnly?: boolean // Disable editing
  emailHeaders?: EmailHeaders // Email metadata
}
```

### EmailHeaders

```typescript
interface EmailHeaders {
  from?: string // Sender email
  to?: string // Recipient email
  subject?: string // Email subject
  date?: string // Send date
}
```

## Result Types

### DocumentSelection

Returned when user confirms selection in edit mode:

```typescript
interface DocumentSelection {
  selectedText: string // Currently selected text
  startOffset: number // Selection start position
  endOffset: number // Selection end position
}
```

### DocumentContent

Available via IPC `getContent` message:

```typescript
interface DocumentContent {
  content: string // Full document content
  cursorPosition: number // Current cursor position
}
```

## IPC Integration

The document canvas supports special IPC messages for AI integration:

### Get Selection

Request current text selection:

```typescript
// Controller sends:
client.send({ type: "getSelection" })

// Canvas responds:
// { type: "selection", data: { selectedText: "...", startOffset: 0, endOffset: 10 } }
```

### Get Content

Request full document content:

```typescript
// Controller sends:
client.send({ type: "getContent" })

// Canvas responds:
// { type: "content", data: { content: "...", cursorPosition: 42 } }
```

### Update Content

Push new content to the canvas:

```typescript
client.send({
  type: "update",
  config: { content: "# Updated Content\n\nNew text here." },
})
```

## Example: AI-Assisted Editing

```typescript
import { editDocument, connectToCanvas } from "./src/api"

async function aiAssistedEdit() {
  // Spawn document editor
  const result = await editDocument(
    {
      content: "# Draft\n\nWrite your thoughts here...",
      title: "AI Draft",
    },
    {
      onReady: async () => {
        // Connect to canvas for real-time interaction
        const client = await connectToCanvas("/tmp/canvas-document-1.sock")

        // Request current selection
        client.send({ type: "getSelection" })

        client.onMessage((msg) => {
          if (msg.type === "selection" && msg.data) {
            // AI can now process the selected text
            console.log("User selected:", msg.data.selectedText)
          }
        })
      },
    }
  )

  if (result.success && result.data) {
    console.log("Final selection:", result.data.selectedText)
  }
}
```

## Markdown Rendering

The document canvas renders markdown with basic formatting:

| Markdown        | Rendering   |
| --------------- | ----------- |
| `# Heading`     | Bold text   |
| `## Subheading` | Bold text   |
| `` `code` ``    | Dimmed text |
| `**bold**`      | Bold text   |
| Regular text    | Normal text |

Note: Full markdown rendering (lists, links, images) is simplified for terminal display.

## Limitations

- Basic markdown rendering only (no tables, images)
- No syntax highlighting for code blocks
- Single cursor (no multi-cursor)
- No undo/redo
- No search/replace
- No line numbers in edit mode

## See Also

- [Canvas Overview](../canvas/SKILL.md) - General canvas system
- [Calendar Canvas](../calendar/SKILL.md) - Calendar scheduling
- [Flight Canvas](../flight/SKILL.md) - Flight booking
