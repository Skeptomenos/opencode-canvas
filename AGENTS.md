# OpenCode Canvas - Agent Knowledge Base

**Project**: Claude-canvas clone for OpenCode
**Status**: Implemented (Phases 1-7 complete)
**Stack**: Bun + SolidJS + @opentui/solid + @opentui/core

## Overview

TUI toolkit providing interactive terminal canvases (calendar, document, flight) spawned via tmux split panes. Port of [dvdsgl/claude-canvas](https://github.com/dvdsgl/claude-canvas) from React/Ink to SolidJS/OpenTUI.

## Build, Lint & Test Commands

```bash
# Install dependencies
bun install

# Development
bun run src/cli.ts show calendar          # Show canvas in current terminal
bun run src/cli.ts spawn calendar         # Spawn canvas in tmux split
bun run src/cli.ts env                    # Check terminal environment

# Type checking
bun run typecheck                          # Full typecheck

# Testing
bun test                                   # Run all tests (6 tests)
bun test src/ipc/server.test.ts            # Run single test file
bun test --watch                           # Watch mode

# Formatting
bun run format                             # Format all files
bun run format:check                       # Check formatting
bun run lint                               # Format check + typecheck

# Building
bun run build                              # Production build
```

## Project Structure

```
src/
├── cli.ts           # CLI entry (spawn/show/update)
├── terminal.ts      # tmux detection + pane spawning
├── canvases/        # Canvas components (calendar.tsx, document.tsx, flight.tsx)
├── ipc/             # Unix socket IPC (server.ts, client.ts, types.ts)
└── api/             # High-level programmatic API
skills/              # OpenCode skill definitions (canvas/, calendar/, document/, flight/)
```

## Code Style Guidelines

### Formatting (Prettier)

```json
{
  "semi": false,
  "printWidth": 120
}
```

- No semicolons
- 120 character line width

### Imports

- Group: stdlib > external packages > internal modules
- Use path aliases: `@/*` for `./src/*`
- Prefer named imports over default imports
- No barrel files unless necessary

### TypeScript

- **AVOID** `any` type - use `unknown` or proper generics
- **AVOID** `as` type assertions - prefer type guards
- **AVOID** `@ts-ignore` / `@ts-expect-error`
- Use explicit return types for exported functions
- Prefer interfaces over type aliases for object shapes

### Variables & Naming

- **PREFER** single-word variable names where possible
- **AVOID** `let` - use `const` exclusively
- **AVOID** unnecessary destructuring: use `obj.a` not `const { a } = obj`
- camelCase for variables/functions
- PascalCase for types/interfaces/components
- SCREAMING_SNAKE for constants

### Control Flow

- **AVOID** `try/catch` where possible - use Result types or early returns
- **AVOID** `else` statements - prefer early returns
- **AVOID** nested conditionals - flatten with guard clauses

### Functions

- Keep things in one function unless composable or reusable
- Prefer arrow functions for callbacks
- Use Bun APIs: `Bun.file()`, `Bun.write()`, `Bun.connect()`, etc.

### Error Handling

- Return errors as values, don't throw
- Use discriminated unions for Result types
- Log errors with context before returning

## SolidJS/OpenTUI Conventions

### JSX Elements (lowercase tags)

```tsx
// Correct - OpenTUI uses lowercase intrinsic elements
<box flexDirection="column">
  <text bold>Title</text>
  <scrollbox height={20}>
    <span>Content</span>
  </scrollbox>
</box>

// Wrong - React-style capitalized components
<Box><Text>Wrong</Text></Box>
```

### State & Input

```tsx
// State: SolidJS signals (NOT React hooks)
const [count, setCount] = createSignal(0)

// Keyboard: OpenTUI (NOT Ink)
useKeyboard((key) => {
  if (key.name === "down") setSelected((s) => s + 1)
})
```

## Component Mapping (React/Ink -> OpenTUI/Solid)

| React/Ink     | OpenTUI/Solid                  |
| ------------- | ------------------------------ |
| `<Box>`       | `<box>`                        |
| `<Text>`      | `<text>` / `<span>`            |
| `useInput()`  | `useKeyboard()`                |
| `useApp()`    | `useRenderer()`                |
| `useStdout()` | `useTerminalDimensions()`      |
| `render()`    | `render()` from @opentui/solid |
| `useState`    | `createSignal`                 |
| `useEffect`   | `createEffect`                 |

## IPC Protocol

**Canvas -> Controller:** `ready`, `selected`, `cancelled`, `error`
**Controller -> Canvas:** `update`, `close`, `ping`, `getSelection`, `getContent`

## Anti-Patterns

- **NEVER** use React/Ink - port to SolidJS/OpenTUI
- **NEVER** add dependencies without checking OpenCode's existing deps first
- **NEVER** spawn outside tmux - check `process.env.TMUX` first
- **NEVER** leave sockets open - cleanup on exit with proper signal handlers
- **NEVER** use `any`, `let`, or `try/catch` without justification
- **NEVER** use React patterns (useState, useEffect, capitalized JSX)

## Reference

- OpenCode TUI: `~/Repos/opencode/packages/opencode/src/cli/cmd/tui/`
- OpenCode Style Guide: `~/Repos/opencode/STYLE_GUIDE.md`
- OpenTUI docs: https://github.com/sst/opentui
- Original claude-canvas: https://github.com/dvdsgl/claude-canvas
