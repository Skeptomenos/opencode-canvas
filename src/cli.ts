#!/usr/bin/env bun
import { program } from "commander"
import { detectTerminal, spawnCanvas } from "./terminal"

function setWindowTitle(title: string): void {
  process.stdout.write(`\x1b]0;${title}\x07`)
}

program
  .name("opencode-canvas")
  .description("Interactive terminal canvases for OpenCode")
  .version("0.1.0")

program
  .command("show [kind]")
  .description("Show a canvas in the current terminal")
  .option("--id <id>", "Canvas ID")
  .option("--config <json>", "Canvas configuration (JSON)")
  .option("--socket <path>", "Unix socket path for IPC")
  .option("--scenario <name>", "Scenario name")
  .action(async (kind = "calendar", options) => {
    const id = options.id || `${kind}-1`
    const config = options.config ? JSON.parse(options.config) : undefined
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
  .command("env")
  .description("Show detected terminal environment")
  .action(() => {
    const env = detectTerminal()
    console.log(`In tmux: ${env.inTmux}`)
    console.log(`Summary: ${env.summary}`)
  })

program.parse()
