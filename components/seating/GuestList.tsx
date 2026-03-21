"use client"

import { useState } from "react"
import { DndContext } from "@dnd-kit/core"
import GuestCard, { type SeatingGuest } from "./GuestCard"
import type { Group } from "@/types/database"

type Props = {
  guests: SeatingGuest[]
  allGuests: SeatingGuest[]          // all guests including assigned, for RSVP sections
  filter: string
  onFilterChange: (v: string) => void
  groups?: Group[]
  onRsvpChange?: (guestId: string, status: string) => Promise<void>
  onSyncRsvps?: () => Promise<void>
  onAssignGroup?: (guestId: string, groupId: string | null) => Promise<void>
}

const RSVP_CYCLE: Record<string, string> = {
  Invited: "Accepted",
  Accepted: "Declined",
  Declined: "Invited",
  Pending: "Accepted",
}

const RSVP_PILL: Record<string, string> = {
  Accepted: "bg-green-100 text-green-700",
  Declined: "bg-red-100 text-red-600",
  Invited: "bg-stone-100 text-stone-500",
  Pending: "bg-amber-100 text-amber-700",
}

type Section = "attending" | "no_response" | "declined"

function RsvpPill({ status, onClick }: { status: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 border-0 ${RSVP_PILL[status] ?? "bg-stone-100 text-stone-500"}`}
      title="Click to cycle RSVP status"
    >
      {status}
    </button>
  )
}

function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = true,
  muted = false,
}: {
  title: string
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
  muted?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        className="w-full flex items-center justify-between mb-1.5 px-1"
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: muted ? "var(--color-subtle)" : "var(--color-charcoal)" }}
        >
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: "white", color: "var(--color-subtle)" }}
          >
            {count}
          </span>
          <span className="text-[10px]" style={{ color: "var(--color-subtle)" }}>
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  )
}

export default function GuestList({
  guests,
  allGuests,
  filter,
  onFilterChange,
  groups,
  onRsvpChange,
  onSyncRsvps,
  onAssignGroup,
}: Props) {
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    if (!onSyncRsvps) return
    setSyncing(true)
    await onSyncRsvps()
    setSyncing(false)
  }

  const filterFn = (g: SeatingGuest) => {
    const q = filter.toLowerCase()
    return (
      g.name.toLowerCase().includes(q) ||
      g.group.toLowerCase().includes(q) ||
      g.side.toLowerCase().includes(q)
    )
  }

  // Categorise all guests
  const attending = allGuests.filter(
    (g) => (g.rsvp_status === "Accepted" || !g.rsvp_status) && filterFn(g)
  )
  const noResponse = allGuests.filter(
    (g) => (g.rsvp_status === "Pending" || g.rsvp_status === "Invited") && filterFn(g)
  )
  const declined = allGuests.filter((g) => g.rsvp_status === "Declined" && filterFn(g))

  // Unassigned attending guests (draggable)
  const unassignedAttending = attending.filter((g) =>
    guests.some((ug) => ug.id === g.id)
  )

  function makeGuestRow(g: SeatingGuest, draggable: boolean) {
    return (
      <div key={g.id} className="flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <GuestCard
            guest={g}
            groups={groups}
            onAssignGroup={onAssignGroup}
          />
        </div>
        {onRsvpChange && (
          <RsvpPill
            status={g.rsvp_status ?? "Invited"}
            onClick={(e) => {
              e.stopPropagation()
              const next = RSVP_CYCLE[g.rsvp_status ?? "Invited"] ?? "Invited"
              onRsvpChange(g.id, next)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search + sync */}
      <div className="flex gap-1.5">
        <input
          type="text"
          placeholder="Filter guests…"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: "var(--color-stone)" }}
        />
        {onSyncRsvps && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="border rounded-lg px-2 py-2 text-xs disabled:opacity-50 hover:bg-stone-50 transition-colors"
            style={{ borderColor: "var(--color-stone)", color: "var(--color-subtle)" }}
            title="Sync RSVPs"
          >
            {syncing ? "…" : "↻"}
          </button>
        )}
      </div>

      {/* Attending section (draggable) */}
      <CollapsibleSection title="Attending" count={unassignedAttending.length}>
        {unassignedAttending.length === 0 ? (
          <p className="text-xs text-center py-2" style={{ color: "var(--color-subtle)" }}>
            All attending guests seated
          </p>
        ) : (
          unassignedAttending.map((g) => makeGuestRow(g, true))
        )}
      </CollapsibleSection>

      {/* No response section (draggable) */}
      {noResponse.length > 0 && (
        <CollapsibleSection title="No Response" count={noResponse.length}>
          {noResponse.map((g) => makeGuestRow(g, true))}
        </CollapsibleSection>
      )}

      {/* Declined section (not draggable — wrapped outside DndContext) */}
      {declined.length > 0 && (
        <CollapsibleSection title="Declined" count={declined.length} muted>
          {declined.map((g) => makeGuestRow(g, false))}
        </CollapsibleSection>
      )}
    </div>
  )
}
