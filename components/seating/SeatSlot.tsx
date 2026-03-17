"use client"

import { useDroppable } from "@dnd-kit/core"
import GuestCard, { type SeatingGuest } from "./GuestCard"

type Props = {
  seatId: string
  guest: SeatingGuest | null
  conflict?: "avoid" | "prefer" | null
  tableId: string
  onUnassign?: () => void
}

export default function SeatSlot({ seatId, guest, conflict, tableId, onUnassign }: Props) {
  const { isOver, setNodeRef } = useDroppable({
    id: seatId,
    data: { seatId, tableId },
  })

  return (
    <div
      ref={setNodeRef}
      className={`
        group relative min-h-[48px] rounded-lg border-2 border-dashed p-1 transition-colors
        ${guest ? "border-transparent" : "border-stone-300"}
        ${isOver && !guest ? "border-pink-400 bg-rose-50" : ""}
        ${isOver && guest ? "border-amber-400 bg-amber-50" : ""}
      `}
    >
      {guest ? (
        <>
          <GuestCard guest={guest} conflict={conflict} compact />
          {onUnassign && (
            <button
              onClick={(e) => { e.stopPropagation(); onUnassign() }}
              className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
              title="Unassign guest"
            >
              ×
            </button>
          )}
        </>
      ) : (
        <div
          className={`h-full flex items-center justify-center text-xs ${isOver ? "text-pink-600" : ""}`}
          style={{ color: isOver ? undefined : "var(--color-subtle)" }}
        >
          {isOver ? "Drop here" : "Empty"}
        </div>
      )}
    </div>
  )
}
