export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay?: boolean
  color?: string
  calendar?: string
}

export interface CalendarConfig {
  events?: CalendarEvent[]
  calendars?: CalendarInfo[]
  initialDate?: string
  slotGranularity?: number
  startHour?: number
  endHour?: number
}

export interface CalendarInfo {
  id: string
  name: string
  color: string
}

export interface TimeSlot {
  hour: number
  minute: number
}

export interface SelectedSlot {
  date: Date
  start: TimeSlot
  end: TimeSlot
}
