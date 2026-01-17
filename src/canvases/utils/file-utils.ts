export const VIEWABLE_EXTENSIONS = new Set([
  "md",
  "txt",
  "json",
  "yaml",
  "yml",
  "toml",
  "ts",
  "tsx",
  "js",
  "jsx",
  "css",
  "html",
  "xml",
  "sh",
  "bash",
  "zsh",
  "py",
  "rb",
  "go",
  "rs",
  "c",
  "cpp",
  "h",
  "hpp",
  "java",
  "kt",
  "swift",
  "sql",
  "graphql",
  "env",
  "gitignore",
  "dockerignore",
  "editorconfig",
  "prettierrc",
  "eslintrc",
])

export function isViewable(path: string): boolean {
  const name = path.split("/").pop() || ""
  if (name.startsWith(".") && !name.includes(".", 1)) return true
  const ext = name.split(".").pop()?.toLowerCase() || ""
  return VIEWABLE_EXTENSIONS.has(ext)
}

export interface DocumentConfig {
  content: string
  title: string
  format: "markdown" | "plain"
  readOnly: boolean
}

export async function loadFileContent(path: string): Promise<DocumentConfig> {
  const file = Bun.file(path)
  const content = await file.text()
  const filename = path.split("/").pop() || path
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  return {
    content,
    title: filename,
    format: ext === "md" ? "markdown" : "plain",
    readOnly: true,
  }
}

export function getFileIcon(name: string, isDirectory: boolean, expanded?: boolean): string {
  if (isDirectory) {
    return expanded !== undefined ? (expanded ? "[-]" : "[+]") : "[D]"
  }
  const ext = name.split(".").pop()?.toLowerCase() || ""
  const icons: Record<string, string> = {
    md: "[M]",
    txt: "[T]",
    ts: "[S]",
    tsx: "[X]",
    js: "[J]",
    jsx: "[X]",
    json: "[N]",
    yaml: "[Y]",
    yml: "[Y]",
    css: "[C]",
    html: "[H]",
    png: "[I]",
    jpg: "[I]",
    jpeg: "[I]",
    gif: "[I]",
    svg: "[I]",
    pdf: "[P]",
    zip: "[Z]",
    tar: "[Z]",
    gz: "[Z]",
  }
  return icons[ext] || "[F]"
}
