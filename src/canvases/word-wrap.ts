/**
 * Word wrap utilities for document viewer and editor
 */

export interface WrappedLine {
  text: string
  originalLineIndex: number
  isWrapped: boolean // true if this is a continuation of the previous line
}

/**
 * Wrap a single line at word boundaries to fit within maxWidth
 */
export function wrapLine(line: string, maxWidth: number, originalLineIndex: number): WrappedLine[] {
  if (line.length <= maxWidth) {
    return [{ text: line, originalLineIndex, isWrapped: false }]
  }

  const result: WrappedLine[] = []
  let remaining = line
  let isFirst = true

  while (remaining.length > 0) {
    if (remaining.length <= maxWidth) {
      result.push({ text: remaining, originalLineIndex, isWrapped: !isFirst })
      break
    }

    // Find the last space within maxWidth
    let breakPoint = maxWidth
    const lastSpace = remaining.lastIndexOf(" ", maxWidth)

    if (lastSpace > 0 && lastSpace > maxWidth * 0.3) {
      // Break at word boundary if we found a reasonable space
      breakPoint = lastSpace
    }

    const chunk = remaining.slice(0, breakPoint)
    result.push({ text: chunk, originalLineIndex, isWrapped: !isFirst })

    // Skip the space if we broke at a word boundary
    remaining = remaining.slice(breakPoint).trimStart()
    isFirst = false
  }

  return result
}

/**
 * Wrap all lines in a document
 */
export function wrapLines(lines: string[], maxWidth: number): WrappedLine[] {
  const result: WrappedLine[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ""
    const wrapped = wrapLine(line, maxWidth, i)
    result.push(...wrapped)
  }

  return result
}

/**
 * Find the display line index for a given original line index
 */
export function findDisplayLineIndex(wrappedLines: WrappedLine[], originalLineIndex: number): number {
  for (let i = 0; i < wrappedLines.length; i++) {
    const wl = wrappedLines[i]
    if (wl && wl.originalLineIndex === originalLineIndex && !wl.isWrapped) {
      return i
    }
  }
  return 0
}

/**
 * Find the original line index for a given display line index
 */
export function findOriginalLineIndex(wrappedLines: WrappedLine[], displayLineIndex: number): number {
  const wl = wrappedLines[displayLineIndex]
  return wl ? wl.originalLineIndex : 0
}
