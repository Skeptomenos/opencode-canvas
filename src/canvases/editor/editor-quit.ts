import type { EditorState } from "./editor-state"
import { performSave, markAsSaved } from "./editor-save"

export type QuitPromptState = "none" | "confirming" | "quitting"

export interface QuitState {
  promptState: QuitPromptState
  message: string | null
  shouldQuit: boolean
  quitAction: "save_and_quit" | "quit_without_save" | "cancel" | null
}

export function createQuitState(): QuitState {
  return {
    promptState: "none",
    message: null,
    shouldQuit: false,
    quitAction: null,
  }
}

export function startQuitConfirmation(quitState: QuitState): QuitState {
  return {
    ...quitState,
    promptState: "confirming",
    message: "Unsaved changes. Save before quitting? [y/n/c]",
    shouldQuit: false,
    quitAction: null,
  }
}

export function cancelQuitConfirmation(quitState: QuitState): QuitState {
  return {
    ...quitState,
    promptState: "none",
    message: null,
    shouldQuit: false,
    quitAction: null,
  }
}

export function confirmQuitWithSave(quitState: QuitState): QuitState {
  return {
    ...quitState,
    promptState: "quitting",
    message: null,
    shouldQuit: true,
    quitAction: "save_and_quit",
  }
}

export function confirmQuitWithoutSave(quitState: QuitState): QuitState {
  return {
    ...quitState,
    promptState: "quitting",
    message: null,
    shouldQuit: true,
    quitAction: "quit_without_save",
  }
}

export function forceQuit(quitState: QuitState): QuitState {
  return {
    ...quitState,
    promptState: "quitting",
    message: null,
    shouldQuit: true,
    quitAction: "quit_without_save",
  }
}

export function canQuitImmediately(editorState: EditorState): boolean {
  return !editorState.isDirty
}

export function getQuitPrompt(quitState: QuitState): string | null {
  if (quitState.promptState !== "confirming") {
    return null
  }
  return quitState.message
}

export async function handleSaveAndQuit(
  editorState: EditorState
): Promise<{ success: boolean; newState: EditorState; error?: string }> {
  const result = await performSave(editorState)
  if (!result.success) {
    return { success: false, newState: editorState, error: result.error }
  }
  return { success: true, newState: markAsSaved(editorState) }
}

export function getTitleWithDirtyIndicator(title: string, isDirty: boolean): string {
  return isDirty ? `${title} *` : title
}

export function getFilenameWithDirtyIndicator(filePath: string | null, isDirty: boolean): string {
  const filename = filePath ?? "untitled"
  return isDirty ? `${filename} *` : filename
}
