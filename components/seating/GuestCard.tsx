"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

export type SeatingGuest = {
  id: string
  name: string
  side: "BRIDE" | "GROOM"
  group: string
  seatId?: string | null
  is_head_table: boolean
  head_guest_id: string | null
  hasPlusOne: boolean
}

type Props = {
  guest: SeatingGuest
  conflict?: "avoid" | "prefer" | null
  compact?: boolean
}

const sideColors = {
  BRIDE: "bg-rose-100 border-rose-300 text-rose-900",
  GROOM: "bg-emerald-100 border-emerald-300 text-emerald-900",
}

const sideBadge = {
  BRIDE: "bg-rose-200 text-rose-800",
  GROOM: "bg-emerald-200 text-emerald-800",
}

export default function GuestCard({ guest, conflict, compact = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: guest.id,
    data: { guest },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        border rounded-lg px-3 py-2 select-none
        ${sideColors[guest.side]}
        ${conflict === "avoid" ? "ring-2 ring-warm-red" : ""}
        ${conflict === "prefer" ? "ring-2 ring-amber-400" : ""}
        ${compact ? "text-xs" : "text-sm"}
        hover:shadow-md transition-shadow
      `}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-medium truncate flex-1 min-w-0">{guest.name}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${sideBadge[guest.side]}`}>
          {guest.side === "BRIDE" ? "B" : "G"}
        </span>
        {conflict === "avoid" && <span title="AVOID violation" className="shrink-0">🚨</span>}
        {conflict === "prefer" && <span title="PREFER suggestion" className="shrink-0">💛</span>}
      </div>
    </div>
  )
}
