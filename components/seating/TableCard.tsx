"use client"

import { useState } from "react"
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
  groupViolations?: Set<string>
  groupWarnings?: Set<string>
  otherTables?: DisplayTable[]
  onUnassignGuest?: (seatId: string) => void
  onClearTable?: (tableId: string) => void
  onAutoFillTable?: (tableId: string) => void
  onRenameTable?: (tableId: string, name: string) => Promise<void>
  onMoveGuest?: (guestId: string, fromSeatId: string, toSeatId: string) => Promise<void>
}

export default function TableCard({
  table,
  avoidViolations,
  preferWarnings,
  groupViolations,
  groupWarnings,
  otherTables,
  onUnassignGuest,
  onClearTable,
  onAutoFillTable,
  onRenameTable,
  onMoveGuest,
}: Props) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(table.name)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [movingSeatId, setMovingSeatId] = useState<string | null>(null)

  const occupiedCount = table.seats.filter((s) => s.guest).length
  const hasConflict =
    table.seats.some((s) => avoidViolations.has(s.id)) ||
    table.seats.some((s) => groupViolations?.has(s.id))
  const hasWarning =
    !hasConflict &&
    (table.seats.some((s) => preferWarnings.has(s.id)) ||
      table.seats.some((s) => groupWarnings?.has(s.id)))
  const hasEmpty = occupiedCount < table.capacity

  async function saveName() {
    if (nameValue.trim() && nameValue.trim() !== table.name && onRenameTable) {
      await onRenameTable(table.id, nameValue.trim())
    }
    setEditingName(false)
  }

  async function handleClear() {
    setShowClearConfirm(false)
    onClearTable?.(table.id)
  }

  return (
    <div
      className="bg-white rounded-xl shadow-md p-4 border-2 transition-colors"
      style={{
        borderColor: hasConflict
          ? "var(--color-warm-red)"
          : hasWarning
          ? "#f59e0b"
          : "var(--color-stone)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName()
                if (e.key === "Escape") { setNameValue(table.name); setEditingName(false) }
              }}
              className="font-semibold border-b focus:outline-none w-36 text-sm"
              style={{ borderColor: "var(--color-charcoal)", color: "var(--color-charcoal)" }}
            />
          ) : (
            <h3
              className="font-semibold cursor-pointer hover:underline"
              style={{ color: "var(--color-charcoal)" }}
              onDoubleClick={() => { setNameValue(table.name); setEditingName(true) }}
              title="Double-click to rename"
            >
              {table.name}
            </h3>
          )}
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
              onClick={() => setShowClearConfirm(true)}
              className="text-xs px-1.5 py-0.5 rounded border hover:bg-red-50 transition-colors"
              style={{ color: "var(--color-warm-red)", borderColor: "var(--color-stone)" }}
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

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="mb-3 p-3 rounded-lg border text-sm" style={{ background: "#fff5f5", borderColor: "var(--color-warm-red)" }}>
          <p className="font-medium mb-2" style={{ color: "var(--color-charcoal)" }}>
            Remove all {occupiedCount} guests from {table.name}? They'll return to the sidebar.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              className="text-xs px-3 py-1.5 rounded-lg text-white"
              style={{ background: "var(--color-warm-red)" }}
            >
              Clear table
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="text-xs px-3 py-1.5 rounded-lg border"
              style={{ borderColor: "var(--color-stone)", color: "var(--color-subtle)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Seats grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {table.seats.map((seat) => {
          const conflict = avoidViolations.has(seat.id) || groupViolations?.has(seat.id)
            ? "avoid"
            : preferWarnings.has(seat.id) || groupWarnings?.has(seat.id)
            ? "prefer"
            : null

          // Find available seats in other tables for move popover
          const availableMoves = seat.guest && otherTables
            ? otherTables.flatMap((t) =>
                t.seats
                  .filter((s) => !s.guest)
                  .map((s) => ({ tableId: t.id, tableName: t.name, seatId: s.id }))
              )
            : []

          return (
            <div key={seat.id} className="relative">
              <SeatSlot
                seatId={seat.id}
                guest={seat.guest}
                conflict={conflict}
                tableId={table.id}
                onUnassign={onUnassignGuest ? () => onUnassignGuest(seat.id) : undefined}
              />
              {/* Move button for occupied seats */}
              {seat.guest && onMoveGuest && availableMoves.length > 0 && (
                <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity z-10">
                  {movingSeatId === seat.id ? (
                    <div
                      className="absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[150px] text-xs"
                      style={{ borderColor: "var(--color-stone)" }}
                    >
                      <div className="px-2 py-1 font-medium border-b text-[10px] uppercase tracking-wide" style={{ color: "var(--color-subtle)", borderColor: "var(--color-stone)" }}>
                        Move to…
                      </div>
                      {otherTables?.map((t) => {
                        const firstEmpty = t.seats.find((s) => !s.guest)
                        if (!firstEmpty) return null
                        return (
                          <button
                            key={t.id}
                            className="w-full text-left px-2 py-1 hover:bg-stone-50 transition-colors"
                            style={{ color: "var(--color-charcoal)" }}
                            onClick={() => {
                              onMoveGuest(seat.guest!.id, seat.id, firstEmpty.id)
                              setMovingSeatId(null)
                            }}
                          >
                            {t.name} ({t.seats.filter((s) => !s.guest).length} free)
                          </button>
                        )
                      })}
                      <button
                        className="w-full text-left px-2 py-1 hover:bg-stone-50 text-gray-400"
                        onClick={() => setMovingSeatId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                  <button
                    className="w-4 h-4 flex items-center justify-center rounded text-[9px] bg-white border shadow-sm hover:bg-stone-50"
                    style={{ borderColor: "var(--color-stone)", color: "var(--color-subtle)" }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMovingSeatId(movingSeatId === seat.id ? null : seat.id)
                    }}
                    title="Move to another table"
                  >
                    ↔
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Close move popover on outside click */}
      {movingSeatId && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setMovingSeatId(null)}
        />
      )}
    </div>
  )
}
