import { createSignal, createMemo, For, onMount } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import type { CalendarConfig, CalendarEvent, SelectedSlot, TimeSlot } from "./calendar/types"
import { useIPCServer } from "./calendar/hooks/use-ipc-server"

export interface CalendarProps {
  id: string
  config?: CalendarConfig
  socketPath?: string
  scenario: string
  onExit: () => void
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const DEFAULT_START_HOUR = 8
const DEFAULT_END_HOUR = 18
const DEFAULT_SLOT_GRANULARITY = 30

export function Calendar(props: CalendarProps) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()

  const config = props.config || {}
  const events = config.events || []
  const startHour = config.startHour ?? DEFAULT_START_HOUR
  const endHour = config.endHour ?? DEFAULT_END_HOUR
  const slotGranularity = config.slotGranularity ?? DEFAULT_SLOT_GRANULARITY

  const [currentDate, setCurrentDate] = createSignal(
    config.initialDate ? new Date(config.initialDate) : new Date()
  )
  const [selectedDay, setSelectedDay] = createSignal(0)
  const [selectedSlot, setSelectedSlot] = createSignal(0)

  const ipc = useIPCServer({
    socketPath: props.socketPath,
    scenario: props.scenario,
    onClose: props.onExit,
  })

  onMount(() => {
    ipc.sendReady()
  })

  const weekStart = createMemo(() => {
    const date = new Date(currentDate())
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(date.setDate(diff))
  })

  const weekDays = createMemo(() => {
    const start = weekStart()
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      return date
    })
  })

  const timeSlots = createMemo(() => {
    const slots: TimeSlot[] = []
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotGranularity) {
        slots.push({ hour, minute })
      }
    }
    return slots
  })

  const getEventsForDay = (date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split("T")[0]
    return events.filter((event) => {
      const eventDate = event.start.split("T")[0]
      return eventDate === dateStr
    })
  }

  const formatTime = (slot: TimeSlot): string => {
    const h = slot.hour.toString().padStart(2, "0")
    const m = slot.minute.toString().padStart(2, "0")
    return `${h}:${m}`
  }

  const formatDate = (date: Date): string => {
    return `${date.getDate()}`
  }

  const isToday = (date: Date): boolean => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const handleSelect = () => {
    const day = weekDays()[selectedDay()]
    const slot = timeSlots()[selectedSlot()]
    const endSlotIndex = Math.min(selectedSlot() + 1, timeSlots().length - 1)
    const endSlot = timeSlots()[endSlotIndex]

    if (!day || !slot || !endSlot) return

    ipc.sendSelected({
      date: day.toISOString(),
      startTime: formatTime(slot),
      endTime: formatTime(endSlot),
    })
  }

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      ipc.sendCancelled("User cancelled")
      renderer.destroy()
      props.onExit()
      return
    }

    if (key.name === "left") {
      setSelectedDay((d) => Math.max(0, d - 1))
    }
    if (key.name === "right") {
      setSelectedDay((d) => Math.min(6, d + 1))
    }
    if (key.name === "up") {
      setSelectedSlot((s) => Math.max(0, s - 1))
    }
    if (key.name === "down") {
      setSelectedSlot((s) => Math.min(timeSlots().length - 1, s + 1))
    }
    if (key.name === "return") {
      handleSelect()
    }
    if (key.name === "t") {
      setCurrentDate(new Date())
      setSelectedDay(0)
      setSelectedSlot(0)
    }
    if (key.name === "[" || (key.shift && key.name === "left")) {
      const newDate = new Date(currentDate())
      newDate.setDate(newDate.getDate() - 7)
      setCurrentDate(newDate)
    }
    if (key.name === "]" || (key.shift && key.name === "right")) {
      const newDate = new Date(currentDate())
      newDate.setDate(newDate.getDate() + 7)
      setCurrentDate(newDate)
    }
  })

  const monthYear = createMemo(() => {
    const date = currentDate()
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  })

  const colWidth = createMemo(() => Math.floor((dimensions().width - 8) / 7))

  return (
    <box flexDirection="column" width={dimensions().width} height={dimensions().height}>
      <box flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1}>
        <text attributes={TextAttributes.BOLD} fg="#00ffff">
          {monthYear()}
        </text>
        <text fg="#808080">
          [←/→] Day [↑/↓] Time [Enter] Select [t] Today [q] Quit
        </text>
      </box>

      <box flexDirection="row" paddingLeft={1} paddingRight={1} marginTop={1}>
        <box width={6} />
        <For each={weekDays()}>
          {(date, i) => (
            <box width={colWidth()} justifyContent="center">
              <text
                attributes={i() === selectedDay() ? TextAttributes.BOLD : 0}
                fg={isToday(date) ? "#00ff00" : i() === selectedDay() ? "#ffffff" : "#808080"}
              >
                {DAYS[i()]} {formatDate(date)}
              </text>
            </box>
          )}
        </For>
      </box>

      <box flexDirection="column" flexGrow={1} overflow="hidden" marginTop={1}>
        <scrollbox height={dimensions().height - 5}>
          <For each={timeSlots()}>
            {(slot, slotIndex) => (
              <box flexDirection="row" paddingLeft={1} paddingRight={1}>
                <box width={6}>
                  <text fg="#808080">{formatTime(slot)}</text>
                </box>
                <For each={weekDays()}>
                  {(date, dayIndex) => {
                    const isSelected = dayIndex() === selectedDay() && slotIndex() === selectedSlot()
                    const dayEvents = getEventsForDay(date)
                    const slotEvent = dayEvents.find((e) => {
                      const eventHour = parseInt(e.start.split("T")[1]?.split(":")[0] || "0")
                      const eventMin = parseInt(e.start.split("T")[1]?.split(":")[1] || "0")
                      return eventHour === slot.hour && eventMin === slot.minute
                    })

                    return (
                      <box
                        width={colWidth()}
                        backgroundColor={isSelected ? "#333366" : undefined}
                      >
                        <text
                          attributes={isSelected ? TextAttributes.BOLD : 0}
                          fg={slotEvent ? (slotEvent.color || "#ffaa00") : (isSelected ? "#ffffff" : "#444444")}
                        >
                          {slotEvent ? slotEvent.title.slice(0, colWidth() - 2) : "─".repeat(Math.max(0, colWidth() - 2))}
                        </text>
                      </box>
                    )
                  }}
                </For>
              </box>
            )}
          </For>
        </scrollbox>
      </box>
    </box>
  )
}
