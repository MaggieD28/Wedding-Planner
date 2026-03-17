"use client"

import SeatSlot from "./SeatSlot"
import type { SeatingGuest } from "./GuestCard"

export type DisplaySeat = {
  id: string
  guest: SeatingGuest | null
}

export type DisplayTable = {
  id: string
  name: string
  capacity: number
  x?: number | null
  y?: number | null
  shape?: string | null
  is_head_table: boolean
  seats: DisplaySeat[]
}

type Props = {
  table: DisplayTable
  avoidViolations: Set<string>
  preferWarnings: Set<string>
  onUnassignGuest?: (seatId: string) => void
  onClearTable?: (tableId: string) => void
  onAutoFillTable?: (tableId: string) => void
}

export default function TableCard({
  table,
  avoidViolations,
  preferWarnings,
  onUnassignGuest,
  onClearTable,
  onAutoFillTable,
}: Props) {
  const occupiedCount = table.seats.filter((s) => s.guest).length
  const hasConflict = table.seats.some((s) => avoidViolations.has(s.id))
  const hasEmpty = occupiedCount < table.capacity

  return (
    <div
      className="bg-white rounded-xl shadow-md p-4 border-2 transition-colors"
      style={{ borderColor: hasConflict ? "var(--color-warm-red)" : "var(--color-stone)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold" style={{ color: "var(--color-charcoal)" }}>{table.name}</h3>
          {table.is_head_table && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium text-white"
              style={{ background: "var(--color-pink)" }}
            >
              Head Table
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {occupiedCount > 0 && onClearTable && (
            <button
              onClick={() => onClearTable(table.id)}
              className="text-xs px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
              style={{ color: "var(--color-subtle)" }}
            >
              Clear
            </button>
          )}
          {hasEmpty && onAutoFillTable && (
            <button
              onClick={() => onAutoFillTable(table.id)}
              className="text-xs px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
              style={{ color: "var(--color-charcoal)" }}
            >
              Fill
            </button>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ color: "var(--color-subtle)", background: "var(--color-blush)" }}
          >
            {occupiedCount}/{table.capacity}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {table.seats.map((seat) => {
          const conflict = avoidViolations.has(seat.id)
            ? "avoid"
            : preferWarnings.has(seat.id)
            ? "prefer"
            : null
          return (
            <SeatSlot
              key={seat.id}
              seatId={seat.id}
              guest={seat.guest}
              conflict={conflict}
              tableId={table.id}
              onUnassign={onUnassignGuest ? () => onUnassignGuest(seat.id) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
