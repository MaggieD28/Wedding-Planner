"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import type { Group } from "@/types/database"

export type SeatingGuest = {
  id: string
  name: string
  side: "BRIDE" | "GROOM"
  group: string
  group_id?: string | null
  rsvp_status?: string
  seatId?: string | null
  is_head_table: boolean
  head_guest_id: string | null
  hasPlusOne: boolean
}

type Props = {
  guest: SeatingGuest
  conflict?: "avoid" | "prefer" | null
  compact?: boolean
  groups?: Group[]
  onAssignGroup?: (guestId: string, groupId: string | null) => Promise<void>
}

const sideColors = {
  BRIDE: "bg-rose-100 border-rose-300 text-rose-900",
  GROOM: "bg-emerald-100 border-emerald-300 text-emerald-900",
}

const sideBadge = {
  BRIDE: "bg-rose-200 text-rose-800",
  GROOM: "bg-emerald-200 text-emerald-800",
}

export default function GuestCard({ guest, conflict, compact = false, groups, onAssignGroup }: Props) {
  const isDeclined = guest.rsvp_status === "Declined"

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: guest.id,
    data: { guest },
    disabled: isDeclined,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : isDeclined ? 0.5 : 1,
    cursor: isDeclined ? "default" : isDragging ? "grabbing" : "grab",
  }

  const groupObj = groups?.find((g) => g.id === guest.group_id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDeclined ? {} : listeners)}
      {...(isDeclined ? {} : attributes)}
      className={`
        border rounded-lg px-3 py-2 select-none
        ${isDeclined ? "bg-gray-100 border-gray-200 text-gray-400 line-through" : sideColors[guest.side]}
        ${conflict === "avoid" ? "ring-2 ring-red-400" : ""}
        ${conflict === "prefer" ? "ring-2 ring-amber-400" : ""}
        ${compact ? "text-xs" : "text-sm"}
        ${isDeclined ? "" : "hover:shadow-md transition-shadow"}
      `}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {guest.head_guest_id && (
          <span className="shrink-0 text-[10px]" title="Plus-one">↗</span>
        )}
        <span className="font-medium truncate flex-1 min-w-0">{guest.name}</span>
        {!isDeclined && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${sideBadge[guest.side]}`}>
            {guest.side === "BRIDE" ? "B" : "G"}
          </span>
        )}
        {conflict === "avoid" && <span title="AVOID violation" className="shrink-0">🚨</span>}
        {conflict === "prefer" && <span title="PREFER suggestion" className="shrink-0">💛</span>}
      </div>

      {/* Group chip */}
      {groupObj && !isDeclined && (
        <div className="flex items-center gap-1 mt-1">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: groupObj.colour }}
          />
          <span className="text-[10px] truncate" style={{ color: "var(--color-subtle)" }}>
            {groupObj.name}
          </span>
        </div>
      )}

      {/* Group selector (only in non-compact mode, only when groups prop is provided) */}
      {groups && groups.length > 0 && !compact && onAssignGroup && !isDeclined && (
        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
          <select
            value={guest.group_id ?? ""}
            onChange={(e) => onAssignGroup(guest.id, e.target.value || null)}
            className="w-full text-[10px] border rounded px-1 py-0.5 bg-white focus:outline-none"
            style={{ borderColor: "var(--color-stone)", color: "var(--color-subtle)" }}
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
