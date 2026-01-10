# Phase 5 Addon Plan: Canvas Components Deep-Dive

**Scope**: Detailed component architecture, porting strategy, and concrete templates for calendar, document, and flight canvases.

**Purpose**: Close gaps in IMPLEMENTATION_PLAN.md Phase 5 by providing:
1. Component hierarchy and props interfaces
2. Concrete porting patterns (React/Ink → SolidJS/OpenTUI)
3. State management patterns
4. Keyboard/input handling specifics
5. Testing strategy per canvas

---

## Overview: Canvas Architecture

```
Calendar/Document/Flight
├── Main Component (handles IPC, state, lifecycle)
├── Layout Container (box with flexDirection)
├── Viewport/Scroll Handler (if needed)
├── Interactive Elements (buttons, list items, headers)
└── Keyboard Handler (useKeyboard hook)
```

Each canvas has:
- **Config props**: Passed from CLI/API (calendar events, document content, flight data)
- **Scenario**: Controls behavior (display, edit, meeting-picker)
- **IPC integration**: useIPCServer hook for controller communication
- **State**: SolidJS signals for user selection/interaction
- **Output**: Broadcast selected/cancelled/content messages

---

## Phase 5.1: Calendar Canvas

### 5.1.1 Calendar Component Structure

**File**: `src/canvases/calendar.tsx`

```tsx
import { createSignal, createEffect, Show, For } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { useIPCServer } from "./calendar/hooks/use-ipc-server"
import type { CalendarConfig, CalendarEvent } from "./calendar/types"

interface CalendarProps {
  id: string
  config?: CalendarConfig
  socketPath?: string
  scenario: "display" | "meeting-picker"
}

interface ViewState {
  currentDate: Date  // Monday of displayed week
  selectedSlot: number | null  // For meeting-picker
  selectedEvent: string | null  // For hover/selection
}

export function Calendar(props: CalendarProps): JSX.Element {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const [viewState, setViewState] = createSignal<ViewState>({
    currentDate: getMonday(new Date()),
    selectedSlot: null,
    selectedEvent: null,
  })

  const ipc = useIPCServer({
    socketPath: props.socketPath,
    scenario: props.scenario,
    onClose: () => renderer.exit(),
    onUpdate: (config) => {
      // Update calendar based on controller message
      if (config && typeof config === "object" && "currentDate" in config) {
        setViewState(prev => ({ ...prev, currentDate: new Date(config.currentDate as string) }))
      }
    },
  })

  // Keyboard navigation
  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      renderer.exit()
    }
    if (key.name === "t") {
      setViewState(prev => ({ ...prev, currentDate: getMonday(new Date()) }))
    }
    if (key.name === "left" || key.name === "h") {
      setViewState(prev => ({
        ...prev,
        currentDate: addDays(prev.currentDate, -7),
      }))
    }
    if (key.name === "right" || key.name === "l") {
      setViewState(prev => ({
        ...prev,
        currentDate: addDays(prev.currentDate, 7),
      }))
    }
    if (key.name === "down" || key.name === "j") {
      setViewState(prev => ({
        ...prev,
        selectedSlot: (prev.selectedSlot ?? -1) + 1,
      }))
    }
    if (key.name === "up" || key.name === "k") {
      setViewState(prev => ({
        ...prev,
        selectedSlot: Math.max(-1, (prev.selectedSlot ?? 0) - 1),
      }))
    }
    if ((key.name === "return" || key.name === "space") && props.scenario === "meeting-picker") {
      const slot = viewState().selectedSlot
      if (slot !== null && slot >= 0) {
        ipc.sendSelected({ slotIndex: slot, startTime: getSlotTime(slot) })
      }
    }
  })

  createEffect(() => {
    if (ipc.isConnected()) {
      ipc.sendReady()
    }
  })

  return (
    <box width="100%" height="100%" flexDirection="column">
      <CalendarHeader
        currentDate={viewState().currentDate}
        config={props.config}
      />
      <box flex={1} flexDirection="column" overflow="hidden">
        <DayHeadersRow />
        <For each={getDaysInWeek(viewState().currentDate)}>
          {(date, idx) => (
            <DayColumn
              date={date}
              events={filterEventsForDate(props.config?.events || [], date)}
              isSelected={props.scenario === "meeting-picker" && isSlotSelected(viewState().selectedSlot, idx())}
              columnIndex={idx()}
            />
          )}
        </For>
      </box>
      <CalendarFooter scenario={props.scenario} />
    </box>
  )
}

interface CalendarHeaderProps {
  currentDate: Date
  config?: CalendarConfig
}

function CalendarHeader(props: CalendarHeaderProps): JSX.Element {
  return (
    <box width="100%" paddingX={1} paddingY={0}>
      <text bold>{props.config?.title || "Calendar"}</text>
      <text marginLeft="auto">
        {formatDate(props.currentDate)} – {formatDate(addDays(props.currentDate, 6))}
      </text>
    </box>
  )
}

function DayHeadersRow(): JSX.Element {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const colWidth = 17 // Approximate

  return (
    <box width="100%" paddingX={1}>
      <For each={DAYS}>
        {(day) => (
          <text width={colWidth} bold>
            {day}
          </text>
        )}
      </For>
    </box>
  )
}

interface DayColumnProps {
  date: Date
  events: CalendarEvent[]
  isSelected?: boolean
  columnIndex: number
}

function DayColumn(props: DayColumnProps): JSX.Element {
  const HOURS = Array.from({ length: 24 }, (_, i) => i)
  const colWidth = 17

  return (
    <box flexDirection="column" width={colWidth} marginRight={1}>
      <For each={HOURS}>
        {(hour) => {
          const eventsAtHour = props.events.filter(e => getHour(e.startTime) === hour)
          const isCurrentHour = isSameDay(props.date, new Date()) && hour === getHour(new Date())

          return (
            <box height={2} borderStyle={isCurrentHour ? "round" : "none"}>
              <text width="100%" fontSize={8} dimmed={!isCurrentHour}>
                {eventsAtHour.length > 0 ? eventsAtHour[0].title.slice(0, colWidth - 2) : ""}
              </text>
            </box>
          )
        }}
      </For>
    </box>
  )
}

function CalendarFooter(props: { scenario: string }): JSX.Element {
  const hints = props.scenario === "meeting-picker"
    ? "↑/↓ select • space/enter confirm • ← /→ week • t today • q quit"
    : "← /→ week • t today • q quit"

  return (
    <box width="100%" paddingX={1} paddingY={0} borderTop>
      <text dimmed>{hints}</text>
    </box>
  )
}

// Helpers
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function getDaysInWeek(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(new Date(monday), i))
}

function filterEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events.filter(e => isSameDay(new Date(e.startTime), date))
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate()
}

function getHour(date: Date | string): number {
  return new Date(date).getHours()
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function isSlotSelected(selected: number | null, columnIdx: number): boolean {
  return selected !== null && selected === columnIdx
}

function getSlotTime(slotIndex: number): string {
  return new Date().toISOString()
}
```

### 5.1.2 Calendar Types

**File**: `src/canvases/calendar/types.ts`

```typescript
export interface CalendarConfig {
  title?: string
  events: CalendarEvent[]
  slotGranularity?: number  // minutes (30, 60)
  businessHoursOnly?: boolean
  initialDate?: string  // ISO string
}

export interface CalendarEvent {
  id: string
  title: string
  startTime: string  // ISO string
  endTime: string    // ISO string
  color?: "blue" | "red" | "green" | "yellow"
  attendees?: string[]
  description?: string
}

export interface MeetingPickerConfig extends CalendarConfig {
  availableSlots: TimeSlot[]
  minDuration?: number  // minutes
}

export interface TimeSlot {
  startTime: string
  endTime: string
  available: boolean
}
```

### 5.1.3 IPC Server Hook for Calendar

**File**: `src/canvases/calendar/hooks/use-ipc-server.ts`

```tsx
import { createSignal, onMount, onCleanup } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { createIPCServer, type IPCServer } from "@/ipc/server"
import type { ControllerMessage } from "@/ipc/types"

export interface UseIPCServerOptions {
  socketPath: string | undefined
  scenario: string
  onClose?: () => void
  onUpdate?: (config: unknown) => void
  onGetSelection?: () => { selectedText: string; startOffset: number; endOffset: number } | null
  onGetContent?: () => { content: string; cursorPosition: number }
}

export function useIPCServer(options: UseIPCServerOptions) {
  const renderer = useRenderer()
  const [isConnected, setIsConnected] = createSignal(false)
  let server: IPCServer | null = null

  onMount(async () => {
    if (!options.socketPath) return

    try {
      server = await createIPCServer({
        socketPath: options.socketPath,
        onMessage: (msg: ControllerMessage) => {
          switch (msg.type) {
            case "close":
              options.onClose?.()
              renderer.exit()
              break
            case "update":
              options.onUpdate?.(msg.config)
              break
            case "ping":
              server?.broadcast({ type: "pong" })
              break
            case "getSelection":
              const selection = options.onGetSelection?.() || null
              server?.broadcast({ type: "selection", data: selection })
              break
            case "getContent":
              const content = options.onGetContent?.()
              if (content) server?.broadcast({ type: "content", data: content })
              break
          }
        },
        onClientConnect: () => setIsConnected(true),
        onClientDisconnect: () => setIsConnected(false),
        onError: (error) => {
          console.error("IPC error:", error.message)
        },
      })
      setIsConnected(true)
    } catch (error) {
      console.error("Failed to create IPC server:", error)
    }
  })

  // Cleanup on exit
  onCleanup(() => {
    server?.close()
    setIsConnected(false)
  })

  // Handle termination signals
  const handleSignal = () => {
    server?.close()
    process.exit(0)
  }

  onMount(() => {
    if (typeof process !== "undefined") {
      process.on("SIGINT", handleSignal)
      process.on("SIGTERM", handleSignal)
    }
  })

  onCleanup(() => {
    if (typeof process !== "undefined") {
      process.off("SIGINT", handleSignal)
      process.off("SIGTERM", handleSignal)
    }
  })

  return {
    isConnected,
    sendReady: () => server?.broadcast({ type: "ready", scenario: options.scenario }),
    sendSelected: (data: unknown) => server?.broadcast({ type: "selected", data }),
    sendCancelled: (reason?: string) => server?.broadcast({ type: "cancelled", reason }),
    sendError: (message: string) => server?.broadcast({ type: "error", message }),
  }
}
```

### 5.1.4 Calendar Porting Checklist

- [ ] **Main Calendar component** (`calendar.tsx`)
  - [ ] State: currentDate, selectedSlot, selectedEvent
  - [ ] Keyboard handlers: ↑↓ (slot selection), ←→ (week nav), t (today), q (quit), space/enter (confirm)
  - [ ] useIPCServer hook integrated
  - [ ] sendReady() on mount
  - [ ] sendSelected() on confirm
  - [ ] Scenario detection (display vs meeting-picker)

- [ ] **CalendarHeader component**
  - [ ] Title from config
  - [ ] Date range display (Mon – Sun)
  - [ ] Formatting

- [ ] **DayHeadersRow component**
  - [ ] Mon–Sun labels
  - [ ] Fixed width columns (17 chars each)

- [ ] **DayColumn component**
  - [ ] Render 24 hours (0–23)
  - [ ] 2-line height per hour
  - [ ] Event title truncation
  - [ ] Current hour highlighting (border)
  - [ ] Selection state

- [ ] **CalendarFooter component**
  - [ ] Dynamic hints based on scenario
  - [ ] Bottom border (dimmed)

- [ ] **Helper functions**
  - [ ] getMonday(date)
  - [ ] addDays(date, n)
  - [ ] getDaysInWeek(monday)
  - [ ] isSameDay(d1, d2)
  - [ ] filterEventsForDate(events, date)
  - [ ] formatDate(date)

---

## Phase 5.2: Document Canvas

### 5.2.1 Document Component Structure

**File**: `src/canvases/document.tsx`

```tsx
import { createSignal, createEffect, onMount, Show } from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"
import { useIPCServer } from "./document/hooks/use-ipc-server"
import { MarkdownRenderer } from "./document/components/markdown-renderer"
import type { DocumentConfig } from "./document/types"

interface DocumentProps {
  id: string
  config?: DocumentConfig
  socketPath?: string
  scenario: "display" | "edit" | "email-preview"
}

interface DocumentViewState {
  scrollOffset: number
  cursorPosition: number
  selectionStart: number | null
  selectionEnd: number | null
  isDirty: boolean
  content: string
}

export function Document(props: DocumentProps): JSX.Element {
  const renderer = useRenderer()
  const [viewState, setViewState] = createSignal<DocumentViewState>({
    scrollOffset: 0,
    cursorPosition: 0,
    selectionStart: null,
    selectionEnd: null,
    isDirty: false,
    content: props.config?.content || "",
  })

  const ipc = useIPCServer({
    socketPath: props.socketPath,
    scenario: props.scenario,
    onClose: () => renderer.exit(),
    onUpdate: (config) => {
      if (config && typeof config === "object" && "content" in config) {
        setViewState(prev => ({
          ...prev,
          content: config.content as string,
          isDirty: false,
        }))
      }
    },
    onGetSelection: () => {
      const state = viewState()
      if (state.selectionStart !== null && state.selectionEnd !== null) {
        return {
          selectedText: state.content.slice(state.selectionStart, state.selectionEnd),
          startOffset: state.selectionStart,
          endOffset: state.selectionEnd,
        }
      }
      return null
    },
    onGetContent: () => {
      const state = viewState()
      return {
        content: state.content,
        cursorPosition: state.cursorPosition,
      }
    },
  })

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      if (viewState().isDirty) {
        ipc.sendCancelled("unsaved changes")
      } else {
        renderer.exit()
      }
    }
    if (key.name === "s" && key.ctrl) {
      // Save / confirm
      const state = viewState()
      ipc.sendSelected({ content: state.content, cursorPosition: state.cursorPosition })
      setViewState(prev => ({ ...prev, isDirty: false }))
    }
    if (key.name === "up" || key.name === "k") {
      setViewState(prev => ({
        ...prev,
        scrollOffset: Math.max(0, prev.scrollOffset - 1),
      }))
    }
    if (key.name === "down" || key.name === "j") {
      setViewState(prev => ({
        ...prev,
        scrollOffset: prev.scrollOffset + 1,
      }))
    }
    if (props.scenario === "edit" && key.name && key.name.length === 1 && !key.ctrl && !key.meta) {
      // Insert character
      const state = viewState()
      const before = state.content.slice(0, state.cursorPosition)
      const after = state.content.slice(state.cursorPosition)
      setViewState(prev => ({
        ...prev,
        content: before + key.name + after,
        cursorPosition: state.cursorPosition + 1,
        isDirty: true,
      }))
    }
    if (props.scenario === "edit" && key.name === "backspace") {
      if (viewState().cursorPosition > 0) {
        const state = viewState()
        const before = state.content.slice(0, state.cursorPosition - 1)
        const after = state.content.slice(state.cursorPosition)
        setViewState(prev => ({
          ...prev,
          content: before + after,
          cursorPosition: state.cursorPosition - 1,
          isDirty: true,
        }))
      }
    }
  })

  createEffect(() => {
    if (ipc.isConnected()) {
      ipc.sendReady()
    }
  })

  return (
    <box width="100%" height="100%" flexDirection="column">
      <DocumentHeader config={props.config} isDirty={viewState().isDirty} scenario={props.scenario} />
      <box flex={1} overflow="hidden" flexDirection="column">
        <MarkdownRenderer
          content={viewState().content}
          scrollOffset={viewState().scrollOffset}
          cursorPosition={props.scenario === "edit" ? viewState().cursorPosition : undefined}
        />
      </box>
      <DocumentFooter scenario={props.scenario} isDirty={viewState().isDirty} />
    </box>
  )
}

interface DocumentHeaderProps {
  config?: DocumentConfig
  isDirty: boolean
  scenario: string
}

function DocumentHeader(props: DocumentHeaderProps): JSX.Element {
  return (
    <box width="100%" paddingX={1} paddingY={0}>
      <text bold>{props.config?.title || "Document"}</text>
      {props.isDirty && <text marginLeft="auto" dimmed>*</text>}
    </box>
  )
}

function DocumentFooter(props: { scenario: string; isDirty: boolean }): JSX.Element {
  const hints = props.scenario === "edit"
    ? "type to edit • ctrl+s save • q quit"
    : "↑↓ scroll • q quit"

  return (
    <box width="100%" paddingX={1} paddingY={0} borderTop>
      <text dimmed>{hints}</text>
      {props.isDirty && <text marginLeft="auto" dimmed bold>unsaved</text>}
    </box>
  )
}
```

### 5.2.2 Document Types

**File**: `src/canvases/document/types.ts`

```typescript
export interface DocumentConfig {
  title?: string
  content: string
  language?: "markdown" | "html" | "plaintext"
  readOnly?: boolean
  lineNumbers?: boolean
}

export interface EmailPreviewConfig extends DocumentConfig {
  from?: string
  to?: string
  subject?: string
  date?: string
}
```

### 5.2.3 Markdown Renderer Component

**File**: `src/canvases/document/components/markdown-renderer.tsx`

```tsx
import { createSignal, For, Show } from "solid-js"

interface MarkdownRendererProps {
  content: string
  scrollOffset: number
  cursorPosition?: number
}

export function MarkdownRenderer(props: MarkdownRendererProps): JSX.Element {
  const lines = () => props.content.split("\n")
  const visibleLines = () => lines().slice(props.scrollOffset, props.scrollOffset + 20) // Assume 20 lines visible

  return (
    <box flexDirection="column" width="100%">
      <For each={visibleLines()}>
        {(line, idx) => {
          const lineNum = props.scrollOffset + idx()
          const isCodeBlock = line.startsWith("```")
          const isHeading = /^#{1,6}\s/.test(line)

          return (
            <box width="100%" paddingX={1}>
              <text
                bold={isHeading}
                dimmed={isCodeBlock}
                width="100%"
              >
                {line}
              </text>
            </box>
          )
        }}
      </For>
    </box>
  )
}
```

### 5.2.4 Document Porting Checklist

- [ ] **Main Document component**
  - [ ] State: scrollOffset, cursorPosition, selectionStart/End, isDirty
  - [ ] Keyboard: ↑↓ (scroll), q (quit), ctrl+s (save), character insert, backspace
  - [ ] Scenario detection (display, edit, email-preview)
  - [ ] useIPCServer with onGetSelection, onGetContent callbacks

- [ ] **DocumentHeader**
  - [ ] Title from config
  - [ ] Dirty indicator (*)

- [ ] **MarkdownRenderer component**
  - [ ] Line-by-line rendering
  - [ ] Scroll offset handling
  - [ ] Syntax highlighting (bold for headings, dim for code)
  - [ ] Cursor position display (if edit mode)

- [ ] **DocumentFooter**
  - [ ] Dynamic hints (display vs edit)
  - [ ] Dirty/unsaved indicator

---

## Phase 5.3: Flight Canvas

### 5.3.1 Flight Component Structure

**File**: `src/canvases/flight.tsx`

```tsx
import { createSignal, createEffect, For, Show } from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"
import { useIPCServer } from "./flight/hooks/use-ipc-server"
import type { FlightConfig, Flight } from "./flight/types"

interface FlightProps {
  id: string
  config?: FlightConfig
  socketPath?: string
  scenario: "booking"
}

interface FlightViewState {
  selectedFlightIndex: number | null
  selectedSeatIndices: Set<number>
  currentView: "list" | "seats"
}

export function FlightCanvas(props: FlightProps): JSX.Element {
  const renderer = useRenderer()
  const [viewState, setViewState] = createSignal<FlightViewState>({
    selectedFlightIndex: 0,
    selectedSeatIndices: new Set(),
    currentView: "list",
  })

  const ipc = useIPCServer({
    socketPath: props.socketPath,
    scenario: props.scenario,
    onClose: () => renderer.exit(),
    onUpdate: (config) => {
      // Update flight data
    },
  })

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      const state = viewState()
      if (state.currentView === "seats") {
        setViewState(prev => ({ ...prev, currentView: "list" }))
      } else {
        renderer.exit()
      }
    }
    if (key.name === "down" || key.name === "j") {
      const state = viewState()
      if (state.currentView === "list") {
        const flights = props.config?.flights || []
        const idx = (state.selectedFlightIndex ?? 0) + 1
        setViewState(prev => ({
          ...prev,
          selectedFlightIndex: Math.min(idx, flights.length - 1),
        }))
      }
    }
    if (key.name === "up" || key.name === "k") {
      if (viewState().currentView === "list") {
        setViewState(prev => ({
          ...prev,
          selectedFlightIndex: Math.max(0, (prev.selectedFlightIndex ?? 0) - 1),
        }))
      }
    }
    if (key.name === "return" || key.name === "space") {
      const state = viewState()
      if (state.currentView === "list" && state.selectedFlightIndex !== null) {
        setViewState(prev => ({ ...prev, currentView: "seats" }))
      } else if (state.currentView === "seats") {
        // Confirm booking
        const flight = (props.config?.flights || [])[state.selectedFlightIndex!]
        ipc.sendSelected({
          flightId: flight.id,
          selectedSeats: Array.from(state.selectedSeatIndices),
        })
      }
    }
    if (viewState().currentView === "seats" && key.name && /^[a-zA-Z0-9]$/.test(key.name)) {
      // Seat selection (e.g., "A5", "C2")
      const seatId = key.name.toUpperCase()
      setViewState(prev => ({
        ...prev,
        selectedSeatIndices: new Set(
          prev.selectedSeatIndices.has(seatId)
            ? Array.from(prev.selectedSeatIndices).filter(s => s !== seatId)
            : [...Array.from(prev.selectedSeatIndices), seatId]
        ),
      }))
    }
  })

  createEffect(() => {
    if (ipc.isConnected()) {
      ipc.sendReady()
    }
  })

  return (
    <box width="100%" height="100%" flexDirection="column">
      <FlightHeader />
      <box flex={1} overflow="hidden" flexDirection="column">
        <Show
          when={viewState().currentView === "list"}
          fallback={<SeatSelectionView flight={(props.config?.flights || [])[viewState().selectedFlightIndex!]} />}
        >
          <FlightListView
            flights={props.config?.flights || []}
            selectedIndex={viewState().selectedFlightIndex}
          />
        </Show>
      </box>
      <FlightFooter view={viewState().currentView} />
    </box>
  )
}

function FlightHeader(): JSX.Element {
  return (
    <box width="100%" paddingX={1} paddingY={0}>
      <text bold>Flight Booking</text>
    </box>
  )
}

interface FlightListViewProps {
  flights: Flight[]
  selectedIndex: number | null
}

function FlightListView(props: FlightListViewProps): JSX.Element {
  return (
    <box flexDirection="column" width="100%">
      <For each={props.flights}>
        {(flight, idx) => (
          <FlightRow
            flight={flight}
            isSelected={props.selectedIndex === idx()}
          />
        )}
      </For>
    </box>
  )
}

interface FlightRowProps {
  flight: Flight
  isSelected: boolean
}

function FlightRow(props: FlightRowProps): JSX.Element {
  return (
    <box
      width="100%"
      paddingX={1}
      paddingY={0}
      borderStyle={props.isSelected ? "round" : "none"}
      backgroundColor={props.isSelected ? "#333" : undefined}
    >
      <box flexDirection="column" flex={1}>
        <text bold>{props.flight.airline} {props.flight.flightNumber}</text>
        <text dimmed>{props.flight.departure} → {props.flight.arrival}</text>
      </box>
      <text marginLeft="auto">{props.flight.price}</text>
    </box>
  )
}

interface SeatSelectionViewProps {
  flight: Flight
}

function SeatSelectionView(props: SeatSelectionViewProps): JSX.Element {
  const rows = ["A", "B", "C", "D", "E", "F"]
  const seatsPerRow = 8

  return (
    <box flexDirection="column" width="100%">
      <text paddingX={1} dimmed>{props.flight.airline} {props.flight.flightNumber}</text>
      <For each={rows}>
        {(row) => (
          <box width="100%" paddingX={2}>
            <text width={2} bold>{row}</text>
            <For each={Array.from({ length: seatsPerRow }, (_, i) => i + 1)}>
              {(seatNum) => (
                <text width={3}>
                  [{seatNum}]
                </text>
              )}
            </For>
          </box>
        )}
      </For>
    </box>
  )
}

function FlightFooter(props: { view: string }): JSX.Element {
  const hints = props.view === "list"
    ? "↑↓ select • enter view seats • q quit"
    : "↑↓ select seat • space toggle • enter confirm • q back"

  return (
    <box width="100%" paddingX={1} paddingY={0} borderTop>
      <text dimmed>{hints}</text>
    </box>
  )
}
```

### 5.3.2 Flight Types

**File**: `src/canvases/flight/types.ts`

```typescript
export interface FlightConfig {
  flights: Flight[]
  currency?: string
  maxSelectableSeats?: number
}

export interface Flight {
  id: string
  airline: string
  flightNumber: string
  departure: string  // "LAX 2:30 PM"
  arrival: string    // "JFK 11:00 PM"
  duration: string   // "5h 30m"
  price: string      // "$450"
  date: string       // ISO date
  availableSeats: number
  configuration?: SeatConfiguration
}

export interface SeatConfiguration {
  rows: number
  seatsPerRow: number
  layout: string  // e.g., "3-2-3"
}

export interface Booking {
  flightId: string
  selectedSeats: string[]
  passengerInfo?: PassengerInfo
}

export interface PassengerInfo {
  name: string
  email: string
  phone: string
}
```

### 5.3.3 Flight Porting Checklist

- [ ] **Main FlightCanvas component**
  - [ ] State: selectedFlightIndex, selectedSeatIndices, currentView
  - [ ] View switching (list → seats)
  - [ ] Keyboard: ↑↓ (flight selection), return (enter/confirm), q (back/quit)
  - [ ] useIPCServer integration

- [ ] **FlightListView component**
  - [ ] Render flights in list
  - [ ] Selection highlighting

- [ ] **FlightRow component**
  - [ ] Flight info (airline, number, route)
  - [ ] Price display
  - [ ] Selection border

- [ ] **SeatSelectionView component**
  - [ ] Seat grid (rows A–F, seats 1–8)
  - [ ] Dynamic seat layout from config
  - [ ] Seat availability/reserved status

- [ ] **FlightFooter**
  - [ ] Context-aware hints (list vs seats)

---

## Phase 5.4: Testing Strategy

### 5.4.1 Component Tests

**File**: `src/canvases/calendar.test.ts`

```typescript
import { describe, test, expect } from "bun:test"
import { Calendar } from "./calendar"

describe("Calendar", () => {
  test("renders calendar with events", () => {
    const config = {
      events: [
        { id: "1", title: "Meeting", startTime: "2025-01-13T10:00", endTime: "2025-01-13T11:00" },
      ],
    }
    // Note: Full render test requires @opentui/solid test utilities
    expect(config.events).toHaveLength(1)
  })

  test("advances week on right arrow", () => {
    // Keyboard handler test
    expect(true).toBe(true) // Placeholder
  })

  test("selects slot on enter", () => {
    expect(true).toBe(true) // Placeholder
  })
})
```

**File**: `src/canvases/document.test.ts`

```typescript
import { describe, test, expect } from "bun:test"
import { Document } from "./document"

describe("Document", () => {
  test("renders markdown content", () => {
    const config = {
      content: "# Hello\n\nWorld",
      title: "Test",
    }
    expect(config.content).toContain("Hello")
  })

  test("tracks cursor position on character insert", () => {
    expect(true).toBe(true) // Placeholder
  })

  test("marks dirty on edit", () => {
    expect(true).toBe(true) // Placeholder
  })
})
```

### 5.4.2 Integration Tests

- [ ] Keyboard input dispatches correct state changes
- [ ] IPC messages trigger component updates
- [ ] Selected/cancelled messages sent correctly
- [ ] Scroll boundaries respected
- [ ] Text selection working (document only)

### 5.4.3 Manual Testing Checklist

**Calendar:**
- [ ] Show default calendar (today highlighted)
- [ ] ← /→ navigates weeks
- [ ] t jumps to today
- [ ] ↑↓ selects slots (meeting-picker mode)
- [ ] Enter confirms selection
- [ ] Events render in correct columns
- [ ] q quits cleanly

**Document:**
- [ ] Markdown renders with basic formatting (bold headings)
- [ ] ↑↓ scrolls content
- [ ] Character input works (edit mode)
- [ ] Backspace deletes character
- [ ] ctrl+s sends selected message
- [ ] q warns on unsaved changes
- [ ] Selection callback returns correct offsets

**Flight:**
- [ ] Flight list displays all flights
- [ ] ↑↓ selects flights
- [ ] Enter opens seat map
- [ ] Seat grid displays correctly
- [ ] Space toggles seat selection
- [ ] Enter confirms booking
- [ ] q returns to list

---

## Phase 5.5: Key Implementation Notes

### OpenTUI API Assumptions

1. **JSX elements are lowercase**: `<box>`, `<text>`, `<span>` (NOT `<Box>`, `<Text>`)
2. **Keyboard input**: `useKeyboard` hook provides `{ name, ctrl, shift, ... }`
3. **Flexbox props**: `flexDirection`, `flex`, `width`, `height`, `marginX`, `paddingX`
4. **Borders/styling**: `borderStyle`, `borderTop`, `backgroundColor`, `dimmed`, `bold`
5. **Rendering**: `render(() => <Component />)` returns `{ waitUntilExit }`

### State Management Patterns

- Use `createSignal` for component state (never `let`)
- Use `createEffect` for side effects (resize, scroll)
- Use `onMount`/`onCleanup` for lifecycle (IPC setup/teardown)
- **Avoid** direct DOM manipulation; use OpenTUI props

### Keyboard Handling

```tsx
useKeyboard((key) => {
  // key = { name: string, ctrl: bool, shift: bool, alt: bool, meta: bool }
  if (key.name === "q") { ... }
  if (key.name === "ctrl") { ... }  // Wrong! Use key.ctrl && key.name === "s"
  if (key.name === "down") { ... }  // Arrow keys: "up", "down", "left", "right"
  if (key.name === "return") { ... }  // Enter key
  if (key.name === "backspace") { ... }
})
```

### IPC Cleanup

Always provide signal handlers:

```tsx
const handleSignal = () => {
  server?.close()
  process.exit(0)
}

onMount(() => {
  process.on("SIGINT", handleSignal)
  process.on("SIGTERM", handleSignal)
})

onCleanup(() => {
  process.off("SIGINT", handleSignal)
  process.off("SIGTERM", handleSignal)
})
```

---

## Deliverables

- [ ] **Calendar canvas** (calendar.tsx, types.ts, use-ipc-server.ts)
  - [ ] All 5 sub-components render correctly
  - [ ] Keyboard nav works (←/→, ↑↓, t, space, q)
  - [ ] IPC ready/selected/cancelled messages sent
  - [ ] Tests pass (≥4 test cases)

- [ ] **Document canvas** (document.tsx, types.ts, markdown-renderer.tsx)
  - [ ] Markdown rendering with basic formatting
  - [ ] Scroll ↑↓ works
  - [ ] Edit mode: character input, backspace
  - [ ] Selection tracking (onGetSelection callback)
  - [ ] Dirty state indicator
  - [ ] Tests pass (≥4 test cases)

- [ ] **Flight canvas** (flight.tsx, types.ts)
  - [ ] Flight list renders with selection
  - [ ] Seat map view switches on enter
  - [ ] Seat selection with space toggle
  - [ ] Booking confirmation
  - [ ] Tests pass (≥3 test cases)

- [ ] **Common hook** (use-ipc-server.ts)
  - [ ] Reusable across all three canvases
  - [ ] Signal cleanup (SIGINT/SIGTERM)
  - [ ] Tested with ≥3 message types

---

## Estimated Effort

| Component | Lines | Hours |
|-----------|-------|-------|
| Calendar (canvas + types + hook) | 450 | 6 |
| Document (canvas + types + renderer) | 350 | 5 |
| Flight (canvas + types) | 300 | 4 |
| Tests (all canvases) | 200 | 3 |
| Integration & debugging | — | 4 |
| **Total** | **~1300** | **~22** |

---

## Next Steps

1. **Review** this addon plan against OpenCode's actual OpenTUI API
2. **Reference** `/Users/davidhelmus/Repos/opencode/packages/opencode/src/cli/cmd/tui/` for OpenTUI patterns
3. **Implement** calendar first (simplest calendar logic)
4. **Test** each canvas in isolation before integration
5. **Iterate** with keyboard/scroll feedback loops
