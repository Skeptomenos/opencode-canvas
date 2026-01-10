import { createSignal, For, onMount } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { useIPCServer } from "./calendar/hooks/use-ipc-server"

export interface FlightConfig {
  flights?: Flight[]
  origin?: string
  destination?: string
  date?: string
}

export interface Flight {
  id: string
  airline: string
  flightNumber: string
  departure: string
  arrival: string
  duration: string
  price: number
  stops: number
  aircraft?: string
}

export interface FlightProps {
  id: string
  config?: FlightConfig
  socketPath?: string
  scenario: string
  onExit: () => void
}

export function FlightCanvas(props: FlightProps) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()

  const config = props.config || {}
  const flights = config.flights || []
  const origin = config.origin || "---"
  const destination = config.destination || "---"
  const date = config.date || new Date().toISOString().split("T")[0]

  const [selectedIndex, setSelectedIndex] = createSignal(0)

  const ipc = useIPCServer({
    socketPath: props.socketPath,
    scenario: props.scenario,
    onClose: props.onExit,
  })

  onMount(() => {
    ipc.sendReady()
  })

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      ipc.sendCancelled("User cancelled")
      renderer.destroy()
      props.onExit()
      return
    }

    if (key.name === "up") {
      setSelectedIndex((i) => Math.max(0, i - 1))
    }

    if (key.name === "down") {
      setSelectedIndex((i) => Math.min(flights.length - 1, i + 1))
    }

    if (key.name === "return") {
      const selected = flights[selectedIndex()]
      if (selected) {
        ipc.sendSelected(selected)
      }
    }
  })

  const formatPrice = (price: number): string => {
    return `$${price.toFixed(0)}`
  }

  const formatStops = (stops: number): string => {
    if (stops === 0) return "Nonstop"
    if (stops === 1) return "1 stop"
    return `${stops} stops`
  }

  return (
    <box flexDirection="column" width={dimensions().width} height={dimensions().height}>
      <box flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1} backgroundColor="#222222">
        <text attributes={TextAttributes.BOLD} fg="#00ffff">
          Flights: {origin} → {destination}
        </text>
        <text fg="#808080">{date}</text>
      </box>

      <box flexDirection="row" paddingLeft={1} paddingRight={1} marginTop={1} backgroundColor="#1a1a1a">
        <box width={12}><text fg="#808080">Airline</text></box>
        <box width={10}><text fg="#808080">Flight</text></box>
        <box width={8}><text fg="#808080">Depart</text></box>
        <box width={8}><text fg="#808080">Arrive</text></box>
        <box width={8}><text fg="#808080">Duration</text></box>
        <box width={10}><text fg="#808080">Stops</text></box>
        <box width={10}><text fg="#808080">Price</text></box>
      </box>

      <scrollbox height={dimensions().height - 5} flexGrow={1}>
        <For each={flights}>
          {(flight, i) => {
            const isSelected = i() === selectedIndex()
            return (
              <box
                flexDirection="row"
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={isSelected ? "#333366" : undefined}
              >
                <box width={12}>
                  <text attributes={isSelected ? TextAttributes.BOLD : 0} fg="#ffffff">
                    {flight.airline}
                  </text>
                </box>
                <box width={10}>
                  <text fg="#aaaaaa">{flight.flightNumber}</text>
                </box>
                <box width={8}>
                  <text fg="#00ff00">{flight.departure}</text>
                </box>
                <box width={8}>
                  <text fg="#ff6600">{flight.arrival}</text>
                </box>
                <box width={8}>
                  <text fg="#808080">{flight.duration}</text>
                </box>
                <box width={10}>
                  <text fg={flight.stops === 0 ? "#00ff00" : "#ffaa00"}>
                    {formatStops(flight.stops)}
                  </text>
                </box>
                <box width={10}>
                  <text attributes={TextAttributes.BOLD} fg="#00ffff">
                    {formatPrice(flight.price)}
                  </text>
                </box>
              </box>
            )
          }}
        </For>

        {flights.length === 0 && (
          <box paddingLeft={1} paddingRight={1} marginTop={2}>
            <text fg="#808080">No flights available. Configure flights via --config.</text>
          </box>
        )}
      </scrollbox>

      <box paddingLeft={1} paddingRight={1} backgroundColor="#222222">
        <text fg="#808080">
          [↑/↓] Select [Enter] Book [q] Quit
        </text>
      </box>
    </box>
  )
}
