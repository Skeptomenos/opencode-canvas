---
name: calendar
description: Interactive terminal calendar for event display and meeting scheduling
keywords: [calendar, scheduling, meeting-picker, time-slot, events]
---

# Calendar Canvas

Interactive terminal-based calendar with week view, event display, and meeting time slot selection.

## Overview

The calendar canvas provides:

- Week view with day columns
- Event rendering with colors
- Time slot selection for meeting scheduling
- Keyboard navigation (week/day/slot)
- Current time indicator

## Quick Start

```bash
# Show calendar in current terminal
bun run src/cli.ts show calendar

# Spawn in tmux split with meeting picker
bun run src/cli.ts spawn calendar --scenario meeting-picker --config '{
  "events": [
    {"id": "1", "title": "Standup", "start": "2025-01-10T09:00", "end": "2025-01-10T09:30"}
  ],
  "slotGranularity": 30
}'
```

## Scenarios

### `display`

View-only calendar. Shows events, allows week navigation, no selection.

```bash
bun run src/cli.ts show calendar --scenario display
```

### `meeting-picker`

Interactive time slot selection. User can navigate and select available slots.

```bash
bun run src/cli.ts spawn calendar --scenario meeting-picker
```

## API Usage

```typescript
import { pickMeetingTime } from "./src/api"

const result = await pickMeetingTime({
  events: [
    {
      id: "1",
      title: "Team Standup",
      start: "2025-01-10T09:00:00",
      end: "2025-01-10T09:30:00",
      color: "#4285f4",
    },
    {
      id: "2",
      title: "Code Review",
      start: "2025-01-10T14:00:00",
      end: "2025-01-10T15:00:00",
    },
  ],
  slotGranularity: 30, // 30-minute slots
  startHour: 9, // Business hours start
  endHour: 17, // Business hours end
})

if (result.success && !result.cancelled) {
  console.log(`Selected slot: ${result.data.date}`)
  console.log(`Time: ${result.data.startTime} - ${result.data.endTime}`)
} else if (result.cancelled) {
  console.log("User cancelled selection")
}
```

## Keyboard Shortcuts

| Key               | Action                             |
| ----------------- | ---------------------------------- |
| `←` / `h`         | Previous week                      |
| `→` / `l`         | Next week                          |
| `↑` / `k`         | Previous time slot                 |
| `↓` / `j`         | Next time slot                     |
| `t`               | Jump to today                      |
| `Space` / `Enter` | Confirm selection (meeting-picker) |
| `q` / `Esc`       | Quit / Cancel                      |

## Configuration

### CalendarConfig

```typescript
interface CalendarConfig {
  events?: CalendarEvent[] // Events to display
  calendars?: CalendarInfo[] // Calendar metadata (colors, names)
  initialDate?: string // Initial date to show (ISO string)
  slotGranularity?: number // Slot duration in minutes (15, 30, 60)
  startHour?: number // First hour to show (0-23)
  endHour?: number // Last hour to show (0-23)
}
```

### CalendarEvent

```typescript
interface CalendarEvent {
  id: string // Unique identifier
  title: string // Event title
  start: string // Start time (ISO string)
  end: string // End time (ISO string)
  allDay?: boolean // All-day event flag
  color?: string // Event color (hex)
  calendar?: string // Calendar ID for grouping
}
```

### CalendarInfo

```typescript
interface CalendarInfo {
  id: string // Calendar identifier
  name: string // Display name
  color: string // Calendar color (hex)
}
```

## Result Types

### MeetingPickerResult

```typescript
interface MeetingPickerResult {
  date: string // Selected date (ISO)
  startTime: string // Slot start time
  endTime: string // Slot end time
}
```

### SelectedSlot (internal)

```typescript
interface SelectedSlot {
  date: Date
  start: TimeSlot // { hour: number, minute: number }
  end: TimeSlot
}
```

## Example: Schedule a Meeting

```typescript
import { pickMeetingTime } from "./src/api"

async function scheduleMeeting() {
  // Fetch existing events from calendar API
  const existingEvents = await fetchCalendarEvents()

  const result = await pickMeetingTime({
    events: existingEvents,
    slotGranularity: 30,
    startHour: 9,
    endHour: 17,
  })

  if (result.success && result.data) {
    // Create the meeting
    await createCalendarEvent({
      title: "New Meeting",
      start: result.data.startTime,
      end: result.data.endTime,
    })
    console.log("Meeting scheduled!")
  }
}
```

## Limitations

- Week view only (no month/day views)
- No recurring event support
- No drag-and-drop (keyboard only)
- No timezone handling (uses local time)
- Display only (no event creation/editing in canvas)

## See Also

- [Canvas Overview](../canvas/SKILL.md) - General canvas system
- [Document Canvas](../document/SKILL.md) - Document editing
- [Flight Canvas](../flight/SKILL.md) - Flight booking
