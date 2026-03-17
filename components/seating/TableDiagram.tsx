"use client"

import { useDroppable } from "@dnd-kit/core"
import type { DisplayTable, DisplaySeat } from "./TableCard"
import type { SeatingGuest } from "./GuestCard"

type DiagramSeatProps = {
  seat: DisplaySeat
  x: number
  y: number
  guest: SeatingGuest | null
  conflict: "avoid" | "prefer" | null
  onUnassign?: () => void
}

function DiagramSeat({ seat, x, y, guest, conflict, onUnassign }: DiagramSeatProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: seat.id,
    data: { seatId: seat.id },
  })

  const bgColor = guest
    ? guest.side === "BRIDE"
      ? isOver ? "#fda4af" : "#ffe4e6"
      : isOver ? "#6ee7b7" : "#d1fae5"
    : isOver
    ? "#fce7f3"
    : "#e7e5e4"

  const borderColor = conflict === "avoid"
    ? "#ef4444"
    : conflict === "prefer"
    ? "#f59e0b"
    : isOver
    ? "#f472b6"
    : guest
    ? "transparent"
    : "#d6d3d1"

  const firstName = guest ? guest.name.split(" ")[0] : "—"
  const fontSize = firstName.length <= 4 ? 11 : firstName.length <= 6 ? 10 : firstName.length <= 8 ? 9 : 8

  return (
    <div
      ref={setNodeRef}
      className="group absolute flex items-center justify-center rounded-full border-2 font-medium transition-colors select-none cursor-default"
      style={{
        width: 48,
        height: 48,
        left: x - 24,
        top: y - 24,
        background: bgColor,
        borderColor,
        color: guest ? "#374151" : "#9ca3af",
        fontSize,
        zIndex: 1,
      }}
      title={guest ? guest.name : "Empty seat"}
    >
      <span className="px-1 text-center leading-tight break-words w-full text-center">{firstName}</span>
      {guest && onUnassign && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnassign() }}
          className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-white border border-stone-300 text-gray-400 hover:text-red-500 hover:border-red-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
          title="Unassign guest"
        >
          ×
        </button>
      )}
    </div>
  )
}

type Props = {
  table: DisplayTable
  effectiveShape: "CIRCLE" | "OVAL" | "RECTANGLE"
  /** Percentage position from room canvas (0–100) */
  x: number
  y: number
  avoidViolations: Set<string>
  preferWarnings: Set<string>
  onUnassignGuest?: (seatId: string) => void
  onClearTable?: (tableId: string) => void
}

export default function TableDiagram({
  table,
  effectiveShape,
  x,
  y,
  avoidViolations,
  preferWarnings,
  onUnassignGuest,
  onClearTable,
}: Props) {
  const N = table.seats.length
  const size = Math.max(200, 200 + (N - 6) * 8)
  const cx = size / 2
  const cy = size / 2
  const orbitR = size / 2 - 32

  const occupiedCount = table.seats.filter((s) => s.guest).length
  const hasConflict = table.seats.some((s) => avoidViolations.has(s.id))

  // Center shape dimensions based on table shape
  const centerW = effectiveShape === "OVAL" ? size * 0.5 : size * 0.4
  const centerH = effectiveShape === "OVAL" ? size * 0.28 : size * 0.4
  const centerRadius = effectiveShape === "RECTANGLE" ? "6px" : "50%"

  return (
    <div
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
        zIndex: 2,
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="relative" style={{ width: size, height: size }}>
          {/* Center shape */}
          <div
            className="absolute flex flex-col items-center justify-center border-2 shadow-sm"
            style={{
              width: centerW,
              height: centerH,
              left: cx - centerW / 2,
              top: cy - centerH / 2,
              background: hasConflict ? "#fef2f2" : "white",
              borderColor: hasConflict ? "#ef4444" : "#e7e5e4",
              borderRadius: centerRadius,
              zIndex: 0,
            }}
          >
            <span
              className="text-xs font-semibold text-center leading-tight px-1 truncate w-full text-center"
              style={{ color: "var(--color-charcoal)" }}
            >
              {table.name}
            </span>
            <span className="text-[10px]" style={{ color: "var(--color-subtle)" }}>
              {occupiedCount}/{table.capacity}
            </span>
          </div>

          {/* Seat bubbles */}
          {table.seats.map((seat, i) => {
            const angle = (i / N) * 2 * Math.PI - Math.PI / 2
            const sx = cx + orbitR * Math.cos(angle)
            const sy = cy + orbitR * Math.sin(angle)
            const conflict = avoidViolations.has(seat.id)
              ? "avoid"
              : preferWarnings.has(seat.id)
              ? "prefer"
              : null
            return (
              <DiagramSeat
                key={seat.id}
                seat={seat}
                x={sx}
                y={sy}
                guest={seat.guest}
                conflict={conflict}
                onUnassign={onUnassignGuest ? () => onUnassignGuest(seat.id) : undefined}
              />
            )
          })}
        </div>

        {/* Clear button */}
        {occupiedCount > 0 && onClearTable && (
          <button
            onClick={() => onClearTable(table.id)}
            className="text-xs px-2 py-0.5 rounded border transition-colors hover:bg-red-50"
            style={{ color: "var(--color-subtle)", borderColor: "var(--color-stone)" }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
