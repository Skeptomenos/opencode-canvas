import type { ReadOnlyReason } from "./editor-state"

const MAX_FILE_SIZE_BYTES = 1024 * 1024 // 1MB
const BINARY_CHECK_BYTES = 8192 // 8KB

export interface ReadOnlyCheckResult {
  isReadOnly: boolean
  reason: ReadOnlyReason
}

export function isInNodeModules(filePath: string): boolean {
  return filePath.includes("/node_modules/") || filePath.includes("\\node_modules\\")
}

export function isInGitDirectory(filePath: string): boolean {
  return filePath.includes("/.git/") || filePath.includes("\\.git\\")
}

export async function isFileTooLarge(filePath: string): Promise<boolean> {
  try {
    const file = Bun.file(filePath)
    const size = file.size
    return size > MAX_FILE_SIZE_BYTES
  } catch {
    return false
  }
}

export async function isBinaryFile(filePath: string): Promise<boolean> {
  try {
    const file = Bun.file(filePath)
    const size = file.size
    const bytesToRead = Math.min(size, BINARY_CHECK_BYTES)

    if (bytesToRead === 0) {
      return false
    }

    const slice = file.slice(0, bytesToRead)
    const buffer = await slice.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    for (const byte of bytes) {
      if (byte === 0) {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

export async function checkReadOnly(filePath: string): Promise<ReadOnlyCheckResult> {
  if (isInNodeModules(filePath)) {
    return { isReadOnly: true, reason: "node_modules" }
  }

  if (isInGitDirectory(filePath)) {
    return { isReadOnly: true, reason: "git_directory" }
  }

  if (await isFileTooLarge(filePath)) {
    return { isReadOnly: true, reason: "file_too_large" }
  }

  if (await isBinaryFile(filePath)) {
    return { isReadOnly: true, reason: "binary_file" }
  }

  return { isReadOnly: false, reason: null }
}

export function getReadOnlyReasonMessage(reason: ReadOnlyReason): string {
  switch (reason) {
    case "node_modules":
      return "File is in node_modules directory"
    case "git_directory":
      return "File is in .git directory"
    case "binary_file":
      return "File is binary"
    case "file_too_large":
      return "File is larger than 1MB"
    case null:
      return ""
  }
}

export function getReadOnlyStatusIndicator(isReadOnly: boolean): string {
  return isReadOnly ? "[Read-only]" : ""
}
