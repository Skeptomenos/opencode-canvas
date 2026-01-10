import { For } from "solid-js"
import { TextAttributes } from "@opentui/core"

interface MarkdownSegment {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  strikethrough?: boolean
  link?: string
  color?: string
}

interface ParsedLine {
  segments: MarkdownSegment[]
  lineType: "h1" | "h2" | "h3" | "h4" | "code" | "quote" | "list" | "hr" | "normal"
  indent: number
}

function parseInlineMarkdown(text: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = []
  let remaining = text
  let currentText = ""

  const patterns = [
    { regex: /^`([^`]+)`/, type: "code" as const },
    { regex: /^\*\*\*([^*]+)\*\*\*/, type: "bolditalic" as const },
    { regex: /^\*\*([^*]+)\*\*/, type: "bold" as const },
    { regex: /^__([^_]+)__/, type: "bold" as const },
    { regex: /^\*([^*]+)\*/, type: "italic" as const },
    { regex: /^_([^_]+)_/, type: "italic" as const },
    { regex: /^~~([^~]+)~~/, type: "strikethrough" as const },
    { regex: /^\[([^\]]+)\]\(([^)]+)\)/, type: "link" as const },
  ]

  while (remaining.length > 0) {
    let matched = false

    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex)
      if (match) {
        if (currentText) {
          segments.push({ text: currentText })
          currentText = ""
        }

        const matchText = match[1] || ""
        const matchLink = match[2] || ""
        if (pattern.type === "link") {
          segments.push({ text: matchText, link: matchLink, color: "#5599ff" })
        } else if (pattern.type === "bolditalic") {
          segments.push({ text: matchText, bold: true, italic: true })
        } else if (pattern.type === "bold") {
          segments.push({ text: matchText, bold: true })
        } else if (pattern.type === "italic") {
          segments.push({ text: matchText, italic: true })
        } else if (pattern.type === "code") {
          segments.push({ text: matchText, code: true, color: "#ffaa00" })
        } else if (pattern.type === "strikethrough") {
          segments.push({ text: matchText, strikethrough: true, color: "#666666" })
        }

        remaining = remaining.slice(match[0].length)
        matched = true
        break
      }
    }

    if (!matched) {
      currentText += remaining[0]
      remaining = remaining.slice(1)
    }
  }

  if (currentText) {
    segments.push({ text: currentText })
  }

  return segments.length > 0 ? segments : [{ text: "" }]
}

export function parseLine(line: string): ParsedLine {
  const trimmed = line.trimStart()
  const indent = line.length - trimmed.length

  if (trimmed.startsWith("# ")) {
    return {
      segments: [{ text: trimmed.slice(2), bold: true, color: "#00ffff" }],
      lineType: "h1",
      indent: 0,
    }
  }

  if (trimmed.startsWith("## ")) {
    return {
      segments: [{ text: trimmed.slice(3), bold: true, color: "#00dddd" }],
      lineType: "h2",
      indent: 0,
    }
  }

  if (trimmed.startsWith("### ")) {
    return {
      segments: [{ text: trimmed.slice(4), bold: true, color: "#00bbbb" }],
      lineType: "h3",
      indent: 0,
    }
  }

  if (trimmed.startsWith("#### ")) {
    return {
      segments: [{ text: trimmed.slice(5), bold: true, color: "#009999" }],
      lineType: "h4",
      indent: 0,
    }
  }

  if (trimmed.startsWith("```")) {
    return {
      segments: [{ text: trimmed, color: "#888888" }],
      lineType: "code",
      indent,
    }
  }

  if (trimmed.startsWith("> ")) {
    const content = trimmed.slice(2)
    return {
      segments: [{ text: "│ ", color: "#666666" }, ...parseInlineMarkdown(content)],
      lineType: "quote",
      indent,
    }
  }

  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
    const content = trimmed.slice(2)
    return {
      segments: [{ text: "• ", color: "#888888" }, ...parseInlineMarkdown(content)],
      lineType: "list",
      indent,
    }
  }

  if (trimmed.match(/^\d+\. /)) {
    const match = trimmed.match(/^(\d+)\. (.*)/)
    if (match) {
      const num = match[1] || ""
      const content = match[2] || ""
      return {
        segments: [{ text: `${num}. `, color: "#888888" }, ...parseInlineMarkdown(content)],
        lineType: "list",
        indent,
      }
    }
  }

  if (trimmed.match(/^[-*_]{3,}$/)) {
    return {
      segments: [{ text: "─".repeat(40), color: "#444444" }],
      lineType: "hr",
      indent: 0,
    }
  }

  if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
    const cells = trimmed.split("|").filter((c) => c.trim() !== "")
    const segments: MarkdownSegment[] = [{ text: "│", color: "#555555" }]
    for (const cell of cells) {
      segments.push(...parseInlineMarkdown(cell))
      segments.push({ text: "│", color: "#555555" })
    }
    return {
      segments,
      lineType: "normal",
      indent,
    }
  }

  return {
    segments: parseInlineMarkdown(line),
    lineType: "normal",
    indent,
  }
}

interface MarkdownLineProps {
  line: string
  inCodeBlock: boolean
}

export function MarkdownLine(props: MarkdownLineProps) {
  if (props.inCodeBlock) {
    return <text fg="#ffaa00">{props.line}</text>
  }

  const parsed = parseLine(props.line)

  return (
    <box flexDirection="row">
      {parsed.indent > 0 && <text>{" ".repeat(parsed.indent)}</text>}
      <For each={parsed.segments}>
        {(segment) => {
          let attrs = 0
          if (segment.bold) attrs |= TextAttributes.BOLD
          if (segment.italic) attrs |= TextAttributes.ITALIC
          if (segment.strikethrough) attrs |= TextAttributes.STRIKETHROUGH

          const color = segment.color || (segment.code ? "#ffaa00" : "#ffffff")
          const displayText = segment.code ? ` ${segment.text} ` : segment.text

          return (
            <text attributes={attrs} fg={color}>
              {displayText}
            </text>
          )
        }}
      </For>
    </box>
  )
}

export function isCodeFence(line: string): boolean {
  return line.trim().startsWith("```")
}
