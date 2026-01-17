import type { EditorState } from "./editor-state"
import { getEditorContent } from "./editor-state"

export type SavePromptState = "none" | "confirming" | "saved"

export interface SaveState {
  promptState: SavePromptState
  message: string | null
  messageTimeout: ReturnType<typeof setTimeout> | null
}

export function createSaveState(): SaveState {
  return {
    promptState: "none",
    message: null,
    messageTimeout: null,
  }
}

export function startSaveConfirmation(saveState: SaveState, filePath: string): SaveState {
  return {
    ...saveState,
    promptState: "confirming",
    message: `Save changes to ${filePath}? [y/n]`,
  }
}

export function cancelSaveConfirmation(saveState: SaveState): SaveState {
  return {
    ...saveState,
    promptState: "none",
    message: null,
  }
}

export function setSavedMessage(saveState: SaveState): SaveState {
  return {
    ...saveState,
    promptState: "saved",
    message: "Saved",
  }
}

export function clearMessage(saveState: SaveState): SaveState {
  if (saveState.messageTimeout) {
    clearTimeout(saveState.messageTimeout)
  }
  return {
    ...saveState,
    promptState: "none",
    message: null,
    messageTimeout: null,
  }
}

export async function createBackup(filePath: string): Promise<boolean> {
  try {
    const backupPath = `${filePath}.bak`
    const file = Bun.file(filePath)

    if (!(await file.exists())) {
      return true
    }

    const content = await file.text()
    await Bun.write(backupPath, content)
    return true
  } catch {
    return false
  }
}

export async function saveFile(filePath: string, content: string): Promise<boolean> {
  try {
    await Bun.write(filePath, content)
    return true
  } catch {
    return false
  }
}

export async function performSave(state: EditorState): Promise<{ success: boolean; error?: string }> {
  if (!state.filePath) {
    return { success: false, error: "No file path specified" }
  }

  if (state.isReadOnly) {
    return { success: false, error: "File is read-only" }
  }

  const content = getEditorContent(state)

  const backupSuccess = await createBackup(state.filePath)
  if (!backupSuccess) {
    return { success: false, error: "Failed to create backup" }
  }

  const saveSuccess = await saveFile(state.filePath, content)
  if (!saveSuccess) {
    return { success: false, error: "Failed to save file" }
  }

  return { success: true }
}

export function markAsSaved(state: EditorState): EditorState {
  return {
    ...state,
    isDirty: false,
    dirtyLines: new Set<number>(),
  }
}

export function shouldTriggerSave(key: { name?: string; ctrl?: boolean; sequence?: string }): boolean {
  if (key.ctrl && key.name === "s") {
    return true
  }
  return false
}
