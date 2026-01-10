import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { createSignal } from "solid-js"

export interface RenderOptions {
  socketPath?: string
  scenario?: string
}

function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H\x1b[?25l")
}

function showCursor(): void {
  process.stdout.write("\x1b[?25h")
}

export async function renderCanvas(
  kind: string,
  id: string,
  config?: unknown,
  options?: RenderOptions
): Promise<void> {
  clearScreen()
  process.on("exit", showCursor)
  process.on("SIGINT", () => {
    showCursor()
    process.exit()
  })

  switch (kind) {
    case "calendar":
      return renderPlaceholder("Calendar", id, options)
    case "document":
      return renderPlaceholder("Document", id, options)
    case "flight":
      return renderPlaceholder("Flight", id, options)
    default:
      console.error(`Unknown canvas: ${kind}`)
      process.exit(1)
  }
}

function PlaceholderCanvas(props: { name: string; id: string; scenario?: string; onExit: () => void }) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const [counter, setCounter] = createSignal(0)

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      renderer.destroy()
      props.onExit()
    }
    if (key.name === "up") setCounter((c) => c + 1)
    if (key.name === "down") setCounter((c) => Math.max(0, c - 1))
  })

  return (
    <box flexDirection="column" padding={1} width={dimensions().width} height={dimensions().height}>
      <text attributes={TextAttributes.BOLD} fg="#00ffff">
        {props.name} Canvas
      </text>
      <text fg="#808080">ID: {props.id}</text>
      <text fg="#808080">Scenario: {props.scenario || "display"}</text>
      <box marginTop={1}>
        <text>Counter: {counter()}</text>
      </box>
      <box marginTop={1}>
        <text fg="#808080">[↑/↓] Change counter [q] Quit</text>
      </box>
    </box>
  )
}

async function renderPlaceholder(name: string, id: string, options?: RenderOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    render(
      () => <PlaceholderCanvas name={name} id={id} scenario={options?.scenario} onExit={resolve} />,
      { exitOnCtrlC: false }
    )
  })
}
