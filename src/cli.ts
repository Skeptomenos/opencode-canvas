#!/usr/bin/env bun
import { program } from "commander"
import { detectTerminal, spawnCanvas } from "./terminal"

function setWindowTitle(title: string): void {
  process.stdout.write(`\x1b]0;${title}\x07`)
}

program.name("opencode-canvas").description("Interactive terminal canvases for OpenCode").version("0.1.0")

program
  .command("show [kind]")
  .description("Show a canvas in the current terminal")
  .option("--id <id>", "Canvas ID")
  .option("--config <json>", "Canvas configuration (JSON)")
  .option("--file <path>", "Load content from file (for document canvas)")
  .option("--edit", "Open document in edit mode (for document canvas)")
  .option("--socket <path>", "Unix socket path for IPC")
  .option("--scenario <name>", "Scenario name")
  .action(async (kind = "calendar", options) => {
    const id = options.id || `${kind}-1`
    let config: Record<string, unknown> = {}
    if (options.config) {
      try {
        config = JSON.parse(options.config) as Record<string, unknown>
      } catch (err) {
        console.error(`Invalid JSON in --config: ${err instanceof Error ? err.message : err}`)
        process.exit(1)
      }
    }

    if (options.file) {
      const file = Bun.file(options.file)
      if (!(await file.exists())) {
        console.error(`File not found: ${options.file}`)
        process.exit(1)
      }
      const content = await file.text()
      const filename = options.file.split("/").pop() || options.file
      config = { ...config, content, title: filename, filePath: options.file }
    }

    if (options.edit) {
      config = { ...config, editable: true }
    }

    setWindowTitle(`canvas: ${kind}`)

    const { renderCanvas } = await import("./canvases")
    await renderCanvas(kind, id, config, {
      socketPath: options.socket,
      scenario: options.scenario || "display",
    })
  })

program
  .command("spawn [kind]")
  .description("Spawn a canvas in a new tmux split")
  .option("--id <id>", "Canvas ID")
  .option("--config <json>", "Canvas configuration (JSON)")
  .option("--socket <path>", "Unix socket path for IPC")
  .option("--scenario <name>", "Scenario name")
  .action(async (kind = "calendar", options) => {
    const id = options.id || `${kind}-${Date.now()}`
    const result = await spawnCanvas(kind, id, options.config, {
      socketPath: options.socket,
      scenario: options.scenario,
    })
    console.log(`Spawned ${kind} canvas '${id}' via ${result.method}`)
  })

program
  .command("browse [path]")
  .description("Browse files and directories, open files to view")
  .option("--hidden", "Show hidden files")
  .option("--tree", "Use tree view with expand/collapse")
  .action(async (path = ".", options) => {
    let absolutePath = path
    if (path.startsWith("~")) {
      absolutePath = path.replace("~", process.env.HOME || "")
    } else if (!path.startsWith("/")) {
      absolutePath = `${process.cwd()}/${path}`
    }
    setWindowTitle(`browse: ${absolutePath}`)

    const { renderCanvas } = await import("./canvases")
    const canvasType = options.tree ? "tree" : "files"
    await renderCanvas(
      canvasType,
      "files-1",
      { path: absolutePath, showHidden: options.hidden },
      { scenario: "browse" }
    )
  })

program
  .command("env")
  .description("Show detected terminal environment")
  .action(() => {
    const env = detectTerminal()
    console.log(`In tmux: ${env.inTmux}`)
    console.log(`Summary: ${env.summary}`)
  })

program.parse()
