---
name: flight
description: Interactive flight booking interface with comparison and selection
keywords: [flight, booking, travel, airline, comparison]
---

# Flight Canvas

Interactive terminal-based flight comparison and booking interface with list navigation and selection.

## Overview

The flight canvas provides:

- Flight comparison table with key details
- Keyboard navigation for flight selection
- Price, duration, and stops display
- Airline and flight number information
- Selection confirmation for booking

## Quick Start

```bash
# Show flight comparison in current terminal
bun run src/cli.ts show flight --config '{
  "origin": "SFO",
  "destination": "JFK",
  "date": "2025-01-15",
  "flights": [
    {"id": "1", "airline": "United", "flightNumber": "UA123", "departure": "08:00", "arrival": "16:30", "duration": "5h30m", "price": 450, "stops": 0},
    {"id": "2", "airline": "Delta", "flightNumber": "DL456", "departure": "10:15", "arrival": "19:00", "duration": "5h45m", "price": 380, "stops": 1}
  ]
}'

# Spawn in tmux split for booking
bun run src/cli.ts spawn flight --scenario booking --config '{...}'
```

## Scenarios

### `booking`

Interactive flight selection for booking. Navigate and select a flight.

```bash
bun run src/cli.ts spawn flight --scenario booking
```

## API Usage

```typescript
import { bookFlight } from "./src/api"

const result = await bookFlight({
  origin: "SFO",
  destination: "JFK",
  date: "2025-01-15",
  flights: [
    {
      id: "ua123",
      airline: "United",
      flightNumber: "UA123",
      departure: "08:00",
      arrival: "16:30",
      duration: "5h30m",
      price: 450,
      stops: 0,
      aircraft: "Boeing 737",
    },
    {
      id: "dl456",
      airline: "Delta",
      flightNumber: "DL456",
      departure: "10:15",
      arrival: "19:00",
      duration: "5h45m",
      price: 380,
      stops: 1,
    },
    {
      id: "aa789",
      airline: "American",
      flightNumber: "AA789",
      departure: "14:00",
      arrival: "22:15",
      duration: "5h15m",
      price: 520,
      stops: 0,
    },
  ],
})

if (result.success && !result.cancelled) {
  const selectedFlight = result.data
  console.log(`Booked: ${selectedFlight.airline} ${selectedFlight.flightNumber}`)
  console.log(`Price: $${selectedFlight.price}`)
  console.log(`Departure: ${selectedFlight.departure}`)
}
```

## Keyboard Shortcuts

| Key         | Action                   |
| ----------- | ------------------------ |
| `↑` / `k`   | Select previous flight   |
| `↓` / `j`   | Select next flight       |
| `Enter`     | Confirm selection / Book |
| `q` / `Esc` | Quit / Cancel            |

## Configuration

### FlightConfig

```typescript
interface FlightConfig {
  flights?: Flight[] // Available flights
  origin?: string // Origin airport code (e.g., "SFO")
  destination?: string // Destination airport code (e.g., "JFK")
  date?: string // Travel date (ISO format)
}
```

### Flight

```typescript
interface Flight {
  id: string // Unique identifier
  airline: string // Airline name (e.g., "United")
  flightNumber: string // Flight number (e.g., "UA123")
  departure: string // Departure time (e.g., "08:00")
  arrival: string // Arrival time (e.g., "16:30")
  duration: string // Flight duration (e.g., "5h30m")
  price: number // Price in dollars
  stops: number // Number of stops (0 = nonstop)
  aircraft?: string // Aircraft type (optional)
}
```

## Display Format

The flight canvas displays a table with columns:

| Column   | Width | Description               |
| -------- | ----- | ------------------------- |
| Airline  | 12    | Airline name              |
| Flight   | 10    | Flight number             |
| Depart   | 8     | Departure time            |
| Arrive   | 8     | Arrival time              |
| Duration | 8     | Flight duration           |
| Stops    | 10    | "Nonstop", "1 stop", etc. |
| Price    | 10    | Price with $ prefix       |

### Color Coding

- **Nonstop flights**: Green stops indicator
- **Flights with stops**: Orange/yellow stops indicator
- **Selected flight**: Highlighted background
- **Price**: Cyan, bold

## Example: Flight Search Integration

```typescript
import { bookFlight } from "./src/api"

async function searchAndBook(origin: string, destination: string, date: string) {
  // Fetch flights from external API
  const flights = await fetchFlightsFromAPI(origin, destination, date)

  // Convert to canvas format
  const canvasFlights = flights.map((f) => ({
    id: f.id,
    airline: f.carrier.name,
    flightNumber: f.carrier.code + f.number,
    departure: formatTime(f.departureTime),
    arrival: formatTime(f.arrivalTime),
    duration: formatDuration(f.durationMinutes),
    price: f.price.amount,
    stops: f.segments.length - 1,
  }))

  // Show flight picker
  const result = await bookFlight({
    origin,
    destination,
    date,
    flights: canvasFlights,
  })

  if (result.success && result.data) {
    // Proceed with booking
    await createBooking(result.data.id)
    console.log(`Booked ${result.data.airline} ${result.data.flightNumber}!`)
  }
}
```

## Result Type

The `bookFlight` function returns the selected `Flight` object:

```typescript
interface CanvasResult<Flight> {
  success: boolean
  data?: Flight // Selected flight (if success && !cancelled)
  cancelled?: boolean // True if user pressed q/Esc
  error?: string // Error message (if !success)
}
```

## Limitations

- No seat selection (flight-level selection only)
- No filtering/sorting in canvas (pre-filter before passing)
- No multi-leg/round-trip support
- No real-time price updates
- Display only (no actual booking API integration)

## Future Enhancements

Potential features for future versions:

- Seat map view and selection
- Filter by price/stops/airline
- Sort by different criteria
- Multi-passenger support
- Fare class selection

## See Also

- [Canvas Overview](../canvas/SKILL.md) - General canvas system
- [Calendar Canvas](../calendar/SKILL.md) - Calendar scheduling
- [Document Canvas](../document/SKILL.md) - Document editing
