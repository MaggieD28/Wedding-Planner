"use client"

import { useDroppable } from "@dnd-kit/core"
import { useEffect, useRef, useState } from "react"
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

  const [shaking, setShaking] = useState(false)
  const prevIsOver = useRef(false)

  // Trigger shake when dragging over an occupied slot
  useEffect(() => {
    if (isOver && guest && !prevIsOver.current) {
      setShaking(true)
      const t = setTimeout(() => setShaking(false), 300)
      return () => clearTimeout(t)
    }
    prevIsOver.current = isOver
  }, [isOver, guest])

  return (
    <>
      <style>{`
        @keyframes seat-shake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-4px); }
          40%  { transform: translateX(4px); }
          60%  { transform: translateX(-4px); }
          80%  { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
        .seat-shake { animation: seat-shake 0.3s ease; }
      `}</style>
      <div
        ref={setNodeRef}
        className={[
          "group relative min-h-[48px] rounded-lg border-2 border-dashed p-1 transition-colors",
          guest ? "border-transparent" : "border-stone-300",
          isOver && !guest ? "border-pink-400 bg-green-50 border-solid" : "",
          isOver && guest ? "border-red-400 bg-red-50 border-solid" : "",
          shaking ? "seat-shake" : "",
        ].join(" ")}
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
            className={`h-full min-h-[36px] flex items-center justify-center text-xs`}
            style={{ color: isOver ? "#16a34a" : "var(--color-subtle)" }}
          >
            {isOver ? "Drop here" : "Empty"}
          </div>
        )}
      </div>
    </>
  )
}
