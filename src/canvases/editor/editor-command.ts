import type { EditorState } from "./editor-state"

export type CommandMode = "none" | "active"

export interface CommandState {
  mode: CommandMode
  buffer: string
}

export function createCommandState(): CommandState {
  return {
    mode: "none",
    buffer: "",
  }
}

export function startCommandMode(state: CommandState): CommandState {
  return {
    mode: "active",
    buffer: ":",
  }
}

export function appendToCommand(state: CommandState, char: string): CommandState {
  if (state.mode !== "active") {
    return state
  }
  return {
    ...state,
    buffer: state.buffer + char,
  }
}

export function deleteFromCommand(state: CommandState): CommandState {
  if (state.mode !== "active" || state.buffer.length <= 1) {
    return {
      mode: "none",
      buffer: "",
    }
  }
  return {
    ...state,
    buffer: state.buffer.slice(0, -1),
  }
}

export function cancelCommandMode(state: CommandState): CommandState {
  return {
    mode: "none",
    buffer: "",
  }
}

export function executeCommand(state: CommandState): { command: string; state: CommandState } {
  const command = state.buffer
  return {
    command,
    state: {
      mode: "none",
      buffer: "",
    },
  }
}

export type ParsedCommand =
  | { type: "save" }
  | { type: "quit" }
  | { type: "save_quit" }
  | { type: "force_quit" }
  | { type: "unknown"; command: string }

export function parseCommand(command: string): ParsedCommand {
  const trimmed = command.trim()

  if (trimmed === ":w") {
    return { type: "save" }
  }
  if (trimmed === ":q") {
    return { type: "quit" }
  }
  if (trimmed === ":wq" || trimmed === ":x") {
    return { type: "save_quit" }
  }
  if (trimmed === ":q!") {
    return { type: "force_quit" }
  }

  return { type: "unknown", command: trimmed }
}

export function shouldStartCommandMode(editorState: EditorState, key: { name?: string; sequence?: string }): boolean {
  if (editorState.mode !== "normal") {
    return false
  }
  return key.sequence === ":"
}

export function getCommandPrompt(state: CommandState): string | null {
  if (state.mode !== "active") {
    return null
  }
  return state.buffer
}
