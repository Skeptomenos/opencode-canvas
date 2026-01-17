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
const CANVAS_LOCK_FILE = "/tmp/opencode-canvas-pane.lock"
const LOCK_TIMEOUT_MS = 5000
const LOCK_STALE_MS = 30000
const REUSE_TIMEOUT_MS = 2000

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function isLockStale(): Promise<boolean> {
  const lockFile = Bun.file(CANVAS_LOCK_FILE)
  if (!(await lockFile.exists())) return false

  try {
    const content = await lockFile.text()
    const parts = content.trim().split(":")
    const pidStr = parts[0] || ""
    const timestampStr = parts[1] || ""
    const pid = parseInt(pidStr, 10)
    const timestamp = parseInt(timestampStr, 10)

    if (isNaN(pid) || isNaN(timestamp)) return true
    if (Date.now() - timestamp > LOCK_STALE_MS) return true
    if (!isProcessRunning(pid)) return true

    return false
  } catch {
    return true
  }
}

async function acquireLock(): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < LOCK_TIMEOUT_MS) {
    const lockFile = Bun.file(CANVAS_LOCK_FILE)
    const exists = await lockFile.exists()

    if (!exists || (await isLockStale())) {
      const lockContent = `${process.pid}:${Date.now()}`
      await Bun.write(CANVAS_LOCK_FILE, lockContent)
      await new Promise((r) => setTimeout(r, 10))
      const content = await Bun.file(CANVAS_LOCK_FILE).text()
      if (content.trim() === lockContent) {
        return true
      }
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  return false
}

async function releaseLock(): Promise<void> {
  try {
    const lockFile = Bun.file(CANVAS_LOCK_FILE)
    if (await lockFile.exists()) {
      const content = await lockFile.text()
      const pidStr = content.split(":")[0] || ""
      const pid = parseInt(pidStr, 10)
      if (pid === process.pid) {
        spawnSync("rm", ["-f", CANVAS_LOCK_FILE])
      }
    }
  } catch (err) {
    console.error("Failed to release lock:", err)
  }
}

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

  const locked = await acquireLock()
  if (!locked) {
    throw new Error("Failed to acquire lock for canvas spawn (another spawn in progress)")
  }

  try {
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
  } finally {
    await releaseLock()
  }
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

  try {
    spawnSync("rm", ["-f", CANVAS_PANE_FILE])
  } catch {}

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

    const timeout = setTimeout(() => {
      killProc.kill()
      resolve(false)
    }, REUSE_TIMEOUT_MS)

    killProc.on("close", () => {
      clearTimeout(timeout)
      setTimeout(() => {
        const args = ["send-keys", "-t", paneId, `clear && ${command}`, "Enter"]
        const proc = spawn("tmux", args)
        proc.on("close", (code) => resolve(code === 0))
        proc.on("error", () => resolve(false))
      }, 150)
    })

    killProc.on("error", () => {
      clearTimeout(timeout)
      resolve(false)
    })
  })
}

/** Future API: Close the canvas pane programmatically */
export async function closeCanvasPane(): Promise<boolean> {
  const paneId = await getCanvasPaneId()
  if (!paneId) return false

  return new Promise((resolve) => {
    const proc = spawn("tmux", ["kill-pane", "-t", paneId])
    proc.on("close", (code) => resolve(code === 0))
    proc.on("error", () => resolve(false))
  })
}
