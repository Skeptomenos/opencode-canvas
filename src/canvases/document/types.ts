export interface DocumentConfig {
  content?: string
  title?: string
  format?: "markdown" | "plain" | "email"
  readOnly?: boolean
  emailHeaders?: EmailHeaders
}

export interface EmailHeaders {
  from?: string
  to?: string
  subject?: string
  date?: string
}

export interface DocumentSelection {
  selectedText: string
  startOffset: number
  endOffset: number
}

export interface DocumentContent {
  content: string
  cursorPosition: number
}
