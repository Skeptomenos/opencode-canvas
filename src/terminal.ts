import { spawn, spawnSync } from "child_process"

export interface TerminalEnvironment {
  inTmux: boolean
  summary: string
}

export function detectTerminal(): TerminalEnvironment {
  const inTmux = !!process.env.TMUX
  return { inTmux, summary: inTmux ? "tmux" : "no tmux" }
}

const CANVAS_PANE_FILE = "/tmp/opencode-canvas-pane-id"

export interface SpawnCanvasOptions {
  socketPath?: string
  scenario?: string
}

export async function spawnCanvas(
  kind: string,
  id: string,
  configJson?: string,
  options?: SpawnCanvasOptions
): Promise<{ method: string }> {
  const env = detectTerminal()

  if (!env.inTmux) {
    throw new Error("Canvas requires tmux. Please run inside a tmux session.")
  }

  const socketPath = options?.socketPath || `/tmp/canvas-${id}.sock`

  const cliPath = new URL("./cli.ts", import.meta.url).pathname
  let command = `bun run ${cliPath} show ${kind} --id ${id}`

  if (configJson) {
    const configFile = `/tmp/canvas-config-${id}.json`
    await Bun.write(configFile, configJson)
    command += ` --config "$(cat ${configFile})"`
  }

  command += ` --socket ${socketPath}`

  if (options?.scenario) {
    command += ` --scenario ${options.scenario}`
  }

  const existingPaneId = await getCanvasPaneId()
  if (existingPaneId) {
    const reused = await reuseExistingPane(existingPaneId, command)
    if (reused) return { method: "tmux-reuse" }
  }

  const created = await createNewPane(command)
  if (created) return { method: "tmux-split" }

  throw new Error("Failed to spawn tmux pane")
}

async function getCanvasPaneId(): Promise<string | null> {
  const file = Bun.file(CANVAS_PANE_FILE)
  if (!(await file.exists())) return null

  const paneId = (await file.text()).trim()
  if (!paneId) return null

  const result = spawnSync("tmux", ["display-message", "-t", paneId, "-p", "#{pane_id}"])
  if (result.status === 0 && result.stdout?.toString().trim() === paneId) {
    return paneId
  }

  return null
}

async function saveCanvasPaneId(paneId: string): Promise<void> {
  await Bun.write(CANVAS_PANE_FILE, paneId)
}

async function createNewPane(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const args = ["split-window", "-h", "-p", "67", "-P", "-F", "#{pane_id}", command]
    const proc = spawn("tmux", args)
    let paneId = ""

    proc.stdout?.on("data", (data) => {
      paneId += data.toString()
    })

    proc.on("close", async (code) => {
      if (code === 0 && paneId.trim()) {
        await saveCanvasPaneId(paneId.trim())
      }
      resolve(code === 0)
    })

    proc.on("error", () => resolve(false))
  })
}

async function reuseExistingPane(paneId: string, command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const killProc = spawn("tmux", ["send-keys", "-t", paneId, "C-c"])

    killProc.on("close", () => {
      setTimeout(() => {
        const args = ["send-keys", "-t", paneId, `clear && ${command}`, "Enter"]
        const proc = spawn("tmux", args)
        proc.on("close", (code) => resolve(code === 0))
        proc.on("error", () => resolve(false))
      }, 150)
    })

    killProc.on("error", () => resolve(false))
  })
}

export async function closeCanvasPane(): Promise<boolean> {
  const paneId = await getCanvasPaneId()
  if (!paneId) return false

  return new Promise((resolve) => {
    const proc = spawn("tmux", ["kill-pane", "-t", paneId])
    proc.on("close", (code) => resolve(code === 0))
    proc.on("error", () => resolve(false))
  })
}
