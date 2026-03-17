"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { createClient } from "@/lib/supabase/client"
import GuestCard, { type SeatingGuest } from "./GuestCard"
import GuestList from "./GuestList"
import TableCard, { type DisplayTable } from "./TableCard"
import TableDiagram from "./TableDiagram"
import RoomCanvas from "./RoomCanvas"
import ConstraintManager, { type DisplayConstraint } from "./ConstraintManager"
import { computeConflicts } from "@/lib/seatingConstraints"
import { computeAutoAssign, type GuestForAssign, type TableForAssign, type ConstraintForAssign } from "@/lib/autoAssign"
import { generateLayout } from "@/lib/roomLayout"
import type { Guest, SeatingTable, Seat, SeatingConstraint, RoomConfig } from "@/types/database"

type GuestWithHeadTable = Guest & { is_head_table: boolean }

type SeatWithGuest = Seat & { guest: GuestWithHeadTable | null }

type TableWithSeats = SeatingTable & { seats: SeatWithGuest[] }

type ConstraintFull = {
  id: string
  guest_a_id: string
  guest_b_id: string
  type: "AVOID" | "PREFER"
  created_at: string
  guest_a: GuestWithHeadTable
  guest_b: GuestWithHeadTable
}

interface Props {
  initialGuests: GuestWithHeadTable[]
  initialTables: TableWithSeats[]
  initialConstraints: ConstraintFull[]
  initialRoomConfig: RoomConfig | null
}

type Tab = "seating" | "room" | "tables"

function toSeatingGuest(g: GuestWithHeadTable, allGuests: GuestWithHeadTable[]): SeatingGuest {
  return {
    id: g.id,
    name: `${g.first_name}${g.last_name ? " " + g.last_name : ""}`,
    side: g.side.toUpperCase() as "BRIDE" | "GROOM",
    group: g.side,
    is_head_table: g.is_head_table ?? false,
    head_guest_id: g.head_guest_id,
    hasPlusOne: allGuests.some((other) => other.head_guest_id === g.id),
  }
}

function buildDisplayTables(
  tables: TableWithSeats[],
  guests: GuestWithHeadTable[]
): DisplayTable[] {
  return tables.map((t) => ({
    id: t.id,
    name: t.name,
    capacity: t.capacity,
    x: t.x,
    y: t.y,
    shape: t.shape,
    is_head_table: t.is_head_table,
    seats: t.seats.map((s) => ({
      id: s.id,
      guest: s.guest ? toSeatingGuest(s.guest, guests) : null,
    })),
  }))
}

export default function SeatingClient({
  initialGuests,
  initialTables,
  initialConstraints,
  initialRoomConfig,
}: Props) {
  const supabase = createClient()

  const [guests] = useState<GuestWithHeadTable[]>(initialGuests)
  const [tables, setTables] = useState<TableWithSeats[]>(initialTables)
  const [constraints, setConstraints] = useState<ConstraintFull[]>(initialConstraints)
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(initialRoomConfig)
  const [tab, setTab] = useState<Tab>("seating")
  const [seatingView, setSeatingView] = useState<"cards" | "diagrams">("cards")
  const [filter, setFilter] = useState("")
  const [activeGuest, setActiveGuest] = useState<SeatingGuest | null>(null)
  const [showConstraints, setShowConstraints] = useState(false)
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [autoAssignResult, setAutoAssignResult] = useState<{ assigned: number; skipped: string[] } | null>(null)

  // New table form state
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editingTableName, setEditingTableName] = useState("")
  const [newTableName, setNewTableName] = useState("")
  const [newTableCount, setNewTableCount] = useState(1)
  const [newTableCapacity, setNewTableCapacity] = useState(initialRoomConfig?.seats_per_table ?? 10)
  const [newTableShape, setNewTableShape] = useState<RoomConfig["table_shape"]>(initialRoomConfig?.table_shape ?? "CIRCLE")
  const [newTableIsHead, setNewTableIsHead] = useState(false)
  const [addingTable, setAddingTable] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Refresh tables and constraints from Supabase
  const refreshTables = useCallback(async () => {
    const { data } = await supabase
      .from("seating_tables")
      .select(`*, seats(*, guest:guests(id, first_name, last_name, side, head_guest_id, is_head_table))`)
      .order("name")
    if (data) setTables(data as TableWithSeats[])
  }, [supabase])

  const refreshConstraints = useCallback(async () => {
    const { data } = await supabase
      .from("seating_constraints")
      .select(`*, guest_a:guests!seating_constraints_guest_a_id_fkey(id, first_name, last_name, side, head_guest_id, is_head_table), guest_b:guests!seating_constraints_guest_b_id_fkey(id, first_name, last_name, side, head_guest_id, is_head_table)`)
    if (data) setConstraints(data as ConstraintFull[])
  }, [supabase])

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("seating-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "seats" }, refreshTables)
      .on("postgres_changes", { event: "*", schema: "public", table: "seating_tables" }, refreshTables)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, refreshTables])

  // Derived state
  const displayTables = buildDisplayTables(tables, guests)

  const seatingGuests = guests.map((g) => toSeatingGuest(g, guests))

  // Identify the couple from the guest list
  const brideGuest = seatingGuests.find((g) => g.name.toLowerCase().startsWith("maggie") && g.side === "BRIDE")
  const groomGuest = seatingGuests.find((g) => g.name.toLowerCase().startsWith("bobby") && g.side === "GROOM")
  const coupleIds = new Set([brideGuest?.id, groomGuest?.id].filter(Boolean) as string[])

  // A guest is assigned if any seat has their guest_id
  const assignedGuestIds = new Set(
    tables.flatMap((t) => t.seats.map((s) => s.guest_id).filter(Boolean))
  )
  // Exclude couple from the regular unassigned list — they appear in the couple section
  const unassignedGuests = seatingGuests.filter((g) => !assignedGuestIds.has(g.id) && !coupleIds.has(g.id))

  const { avoidViolations, preferWarnings } = computeConflicts(
    tables.map((t) => ({
      id: t.id,
      seats: t.seats.map((s) => ({ id: s.id, guest_id: s.guest_id })),
    })),
    constraints.map((c) => ({
      id: c.id,
      guest_a_id: c.guest_a_id,
      guest_b_id: c.guest_b_id,
      type: c.type,
    }))
  )

  const displayConstraints: DisplayConstraint[] = constraints.map((c) => ({
    id: c.id,
    guest_a_id: c.guest_a_id,
    guest_b_id: c.guest_b_id,
    type: c.type,
    guest_a: toSeatingGuest(c.guest_a, guests),
    guest_b: toSeatingGuest(c.guest_b, guests),
  }))

  const avoidCount = Math.round(avoidViolations.size / 2)
  const preferCount = Math.round(preferWarnings.size / 2)

  // --- Drag handlers ---
  const handleDragStart = (event: DragStartEvent) => {
    const guest = event.active.data.current?.guest as SeatingGuest
    setActiveGuest(guest ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveGuest(null)
    const { active, over } = event
    if (!over) return

    const guestId = active.id as string
    const targetSeatId = over.id as string

    // Check if guest is already in this seat
    const currentSeatId = tables
      .flatMap((t) => t.seats)
      .find((s) => s.guest_id === guestId)?.id
    if (currentSeatId === targetSeatId) return

    // Clear guest from their current seat (if any)
    if (currentSeatId) {
      await supabase.from("seats").update({ guest_id: null }).eq("id", currentSeatId)
    }
    // Assign guest to target seat (displaces any existing occupant)
    await supabase.from("seats").update({ guest_id: guestId }).eq("id", targetSeatId)
    await refreshTables()
  }

  const handleUnassignGuest = async (seatId: string) => {
    await supabase.from("seats").update({ guest_id: null }).eq("id", seatId)
    await refreshTables()
  }

  const handleClearTable = async (tableId: string) => {
    const seatIds = tables.find((t) => t.id === tableId)?.seats.map((s) => s.id) ?? []
    if (seatIds.length === 0) return
    await supabase.from("seats").update({ guest_id: null }).in("id", seatIds)
    await refreshTables()
  }

  const handleAutoFillTable = async (tableId: string) => {
    const tableName = tables.find((t) => t.id === tableId)?.name ?? "table"
    if (unassignedGuests.length === 0) {
      alert("No unassigned guests to fill with.")
      return
    }
    if (!confirm(`Fill ${tableName} with unassigned guests?`)) return

    setAutoAssignResult(null)
    const result = await runAutoAssign(tableId)
    setAutoAssignResult(result)
  }

  const handleAutoAssign = async () => {
    if (unassignedGuests.length === 0) {
      alert("All guests are already assigned.")
      return
    }
    if (!confirm(`Auto-assign ${unassignedGuests.length} unassigned guests to available seats?`)) return

    setAutoAssigning(true)
    setAutoAssignResult(null)
    const result = await runAutoAssign()
    setAutoAssignResult(result)
    setAutoAssigning(false)
  }

  const runAutoAssign = async (tableId?: string) => {
    const unassignedForAssign: GuestForAssign[] = unassignedGuests.map((g) => ({
      id: g.id,
      name: g.name,
      side: g.side,
      is_head_table: g.is_head_table,
      head_guest_id: g.head_guest_id,
      hasPlusOne: g.hasPlusOne,
    }))

    const tablesForAssign: TableForAssign[] = tables.map((t) => ({
      id: t.id,
      is_head_table: t.is_head_table,
      seats: t.seats.map((s) => ({
        id: s.id,
        guest_id: s.guest_id,
        guest_side: s.guest?.side ?? null,
      })),
    }))

    const constraintsForAssign: ConstraintForAssign[] = constraints.map((c) => ({
      guest_a_id: c.guest_a_id,
      guest_b_id: c.guest_b_id,
      type: c.type,
    }))

    const { assignments, skipped } = computeAutoAssign(
      unassignedForAssign,
      tablesForAssign,
      constraintsForAssign,
      tableId
    )

    // Apply assignments in batch
    for (const { seatId, guestId } of assignments) {
      await supabase.from("seats").update({ guest_id: guestId }).eq("id", seatId)
    }

    await refreshTables()
    return { assigned: assignments.length, skipped }
  }

  // --- Constraint handlers ---
  const handleAddConstraint = async (
    guestAId: string,
    guestBId: string,
    type: "AVOID" | "PREFER"
  ) => {
    const { error } = await supabase
      .from("seating_constraints")
      .insert({ guest_a_id: guestAId, guest_b_id: guestBId, type })
    if (error) throw new Error("duplicate")
    await refreshConstraints()
  }

  const handleDeleteConstraint = async (id: string) => {
    await supabase.from("seating_constraints").delete().eq("id", id)
    await refreshConstraints()
  }

  // --- Room canvas ---
  const handleTableMove = async (id: string, x: number, y: number) => {
    await supabase.from("seating_tables").update({ x, y }).eq("id", id)
    await refreshTables()
  }

  const handleAutoLayout = async () => {
    if (tables.length === 0) return
    const config = {
      roomShape: "RECTANGLE",
      aspectRatio: roomConfig?.aspect_ratio ?? 1.5,
      tableShape: roomConfig?.table_shape ?? "CIRCLE",
      seatsPerTable: roomConfig?.seats_per_table ?? 10,
      guestCount: guests.length,
      venueCapacity: tables.reduce((s, t) => s + t.capacity, 0),
    }
    const positions = generateLayout(config, tables.length)
    for (let i = 0; i < tables.length; i++) {
      const pos = positions[i]
      if (pos) {
        await supabase.from("seating_tables").update({ x: pos.x, y: pos.y }).eq("id", tables[i].id)
      }
    }
    await refreshTables()
  }

  // --- Room config ---
  const handleRoomConfigChange = async (patch: Partial<RoomConfig>) => {
    const updated = { ...roomConfig, ...patch } as RoomConfig
    if (roomConfig?.id) {
      await supabase.from("room_config").update(patch).eq("id", roomConfig.id)
      setRoomConfig(updated)
    } else {
      const { data } = await supabase
        .from("room_config")
        .insert({ aspect_ratio: 1.5, table_shape: "CIRCLE", seats_per_table: 10, ...patch })
        .select()
        .single()
      if (data) setRoomConfig(data as RoomConfig)
    }
    // Sync table form defaults when room config changes
    if (patch.seats_per_table !== undefined) setNewTableCapacity(patch.seats_per_table)
    if (patch.table_shape !== undefined) setNewTableShape(patch.table_shape)
  }

  // --- Table management ---
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTableName.trim()) return
    setAddingTable(true)

    const count = Math.max(1, newTableCount)
    const baseName = newTableName.trim()

    const tableRows = Array.from({ length: count }, (_, i) => ({
      name: count === 1 ? baseName : `${baseName} ${i + 1}`,
      capacity: newTableCapacity,
      shape: newTableShape,
      is_head_table: newTableIsHead,
    }))

    const { data: newTables, error } = await supabase
      .from("seating_tables")
      .insert(tableRows)
      .select()

    if (!error && newTables) {
      const seatRows = newTables.flatMap((t) =>
        Array.from({ length: newTableCapacity }, () => ({ table_id: t.id }))
      )
      await supabase.from("seats").insert(seatRows)
    }

    setNewTableName("")
    setNewTableCount(1)
    setNewTableCapacity(roomConfig?.seats_per_table ?? 10)
    setNewTableShape(roomConfig?.table_shape ?? "CIRCLE")
    setNewTableIsHead(false)
    setAddingTable(false)
    await refreshTables()
  }

  const handleRenameTable = async (tableId: string) => {
    const name = editingTableName.trim()
    if (name) {
      await supabase.from("seating_tables").update({ name }).eq("id", tableId)
      await refreshTables()
    }
    setEditingTableId(null)
  }

  const handleDeleteTable = async (tableId: string) => {
    const name = tables.find((t) => t.id === tableId)?.name ?? "this table"
    if (!confirm(`Delete "${name}" and all its seats?`)) return
    await supabase.from("seating_tables").delete().eq("id", tableId)
    await refreshTables()
  }

  const venueCapacity = tables.reduce((s, t) => s + t.capacity, 0)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--color-charcoal)", fontFamily: "var(--font-heading), Georgia, serif" }}
          >
            Seating Plan
          </h1>
          <div className="flex gap-3 mt-1 text-xs" style={{ color: "var(--color-subtle)" }}>
            {avoidViolations.size > 0 && (
              <span className="font-medium" style={{ color: "var(--color-warm-red)" }}>
                🚨 {avoidCount} AVOID conflict{avoidCount !== 1 ? "s" : ""}
              </span>
            )}
            {preferWarnings.size > 0 && (
              <span className="font-medium" style={{ color: "#a07820" }}>
                💛 {preferCount} PREFER suggestion{preferCount !== 1 ? "s" : ""}
              </span>
            )}
            {avoidViolations.size === 0 && preferWarnings.size === 0 && constraints.length > 0 && (
              <span className="font-medium" style={{ color: "var(--color-sage)" }}>✓ No conflicts</span>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex gap-2">
          <button
            onClick={handleAutoAssign}
            disabled={autoAssigning}
            className="border rounded-lg px-4 py-2 text-sm disabled:opacity-50 transition-colors hover:bg-stone-100"
            style={{ borderColor: "var(--color-sage)", color: "var(--color-charcoal)" }}
          >
            {autoAssigning ? "Assigning…" : "Auto Assign"}
          </button>
          <button
            onClick={() => setShowConstraints(true)}
            className="border rounded-lg px-4 py-2 text-sm transition-colors hover:bg-stone-100"
            style={{
              borderColor: avoidViolations.size > 0 ? "var(--color-warm-red)" : "var(--color-stone)",
              color: avoidViolations.size > 0 ? "var(--color-warm-red)" : "var(--color-subtle)",
            }}
          >
            Constraints ({constraints.length})
          </button>
          <button
            onClick={() => window.print()}
            className="border rounded-lg px-4 py-2 text-sm transition-colors hover:bg-stone-100 print:hidden"
            style={{ borderColor: "var(--color-stone)", color: "var(--color-subtle)" }}
          >
            Print
          </button>
        </div>
      </div>

      {/* Auto-assign result banner */}
      {autoAssignResult && (
        <div
          className="mb-4 p-3 rounded-lg border text-sm flex items-center justify-between"
          style={{
            background: autoAssignResult.skipped.length > 0 ? "#fffbeb" : "#f0fdf4",
            borderColor: autoAssignResult.skipped.length > 0 ? "#fcd34d" : "#86efac",
          }}
        >
          <span>
            <strong>{autoAssignResult.assigned} guest{autoAssignResult.assigned !== 1 ? "s" : ""} assigned.</strong>
            {autoAssignResult.skipped.length > 0 && (
              <span className="text-yellow-700 ml-2">
                {autoAssignResult.skipped.length} couldn&apos;t be placed: {autoAssignResult.skipped.join(", ")}
              </span>
            )}
          </span>
          <button onClick={() => setAutoAssignResult(null)} style={{ color: "var(--color-subtle)" }} className="ml-4">
            &times;
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--color-stone)" }}>
        {(["seating", "room", "tables"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition-colors"
            style={{
              borderBottomColor: tab === t ? "var(--color-charcoal)" : "transparent",
              color: tab === t ? "var(--color-charcoal)" : "var(--color-subtle)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Seating tab */}
      {tab === "seating" && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* View toggle */}
          <div className="flex justify-end mb-3">
            <div
              className="flex rounded-lg border overflow-hidden text-xs"
              style={{ borderColor: "var(--color-stone)" }}
            >
              {(["cards", "diagrams"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setSeatingView(v)}
                  className="px-3 py-1.5 capitalize transition-colors"
                  style={{
                    background: seatingView === v ? "var(--color-charcoal)" : "white",
                    color: seatingView === v ? "white" : "var(--color-subtle)",
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4 items-start">
            {/* Unassigned guests sidebar */}
            <div
              className="w-64 flex-shrink-0 rounded-xl shadow-sm border p-4 sticky top-6 self-start"
              style={{ background: "var(--color-blush)", borderColor: "var(--color-stone)" }}
            >
              {/* Couple cards */}
              <div className="mb-3 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide px-1" style={{ color: "var(--color-subtle)" }}>
                  The Couple
                </p>
                {[
                  { guest: brideGuest, label: "Maggie", role: "Bride", colors: "bg-rose-50 border-rose-300 text-rose-800" },
                  { guest: groomGuest, label: "Bobby",  role: "Groom", colors: "bg-emerald-50 border-emerald-300 text-emerald-800" },
                ].map(({ guest, label, role, colors }) =>
                  guest ? (
                    <div key={role} className="relative">
                      <GuestCard guest={guest} />
                      {assignedGuestIds.has(guest.id) && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none" style={{ color: "var(--color-subtle)" }}>
                          {tables.find((t) => t.seats.some((s) => s.guest_id === guest.id))?.name ?? ""}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div key={role} className={`rounded-lg border-2 px-3 py-2 text-xs font-medium ${colors}`}>
                      <span>{label}</span>
                      <span className="ml-1 opacity-60">· {role} · not in guest list</span>
                    </div>
                  )
                )}
              </div>

              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm" style={{ color: "var(--color-charcoal)" }}>Unassigned</h2>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "white", color: "var(--color-subtle)" }}
                >
                  {unassignedGuests.length}
                </span>
              </div>
              <GuestList guests={unassignedGuests} filter={filter} onFilterChange={setFilter} />
            </div>

            {/* Table grid */}
            <div className="flex-1 overflow-y-auto">
              {displayTables.length === 0 ? (
                <div
                  className="flex items-center justify-center h-full text-sm cursor-pointer"
                  style={{ color: "var(--color-subtle)" }}
                  onClick={() => setTab("tables")}
                >
                  No tables yet. Click to add tables.
                </div>
              ) : seatingView === "cards" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {displayTables.map((table) => (
                    <TableCard
                      key={table.id}
                      table={table}
                      avoidViolations={avoidViolations}
                      preferWarnings={preferWarnings}
                      onUnassignGuest={handleUnassignGuest}
                      onClearTable={handleClearTable}
                      onAutoFillTable={handleAutoFillTable}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="relative w-full rounded-xl border overflow-hidden"
                  style={{
                    aspectRatio: roomConfig?.aspect_ratio ?? 1.5,
                    background: "#FAF6F0",
                    borderColor: "var(--color-stone)",
                  }}
                >
                  {displayTables.map((table) => (
                    <TableDiagram
                      key={table.id}
                      table={table}
                      effectiveShape={(table.shape ?? roomConfig?.table_shape ?? "CIRCLE") as "CIRCLE" | "OVAL" | "RECTANGLE"}
                      x={table.x ?? 50}
                      y={table.y ?? 50}
                      avoidViolations={avoidViolations}
                      preferWarnings={preferWarnings}
                      onUnassignGuest={handleUnassignGuest}
                      onClearTable={handleClearTable}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeGuest ? <GuestCard guest={activeGuest} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Room tab */}
      {tab === "room" && (
        <div>
          {/* Room config settings bar */}
          <div
            className="flex flex-wrap items-center gap-4 mb-4 p-3 rounded-xl border text-sm"
            style={{ borderColor: "var(--color-stone)", background: "var(--color-blush)" }}
          >
            {/* Orientation toggle */}
            {(() => {
              const ratio = roomConfig?.aspect_ratio ?? 1.5
              const isLandscape = ratio >= 1
              const baseRatio = isLandscape ? ratio : 1 / ratio
              return (
                <>
                  <div
                    className="flex rounded-lg border overflow-hidden text-xs"
                    style={{ borderColor: "var(--color-stone)" }}
                  >
                    {([["landscape", "⬛ Landscape"], ["portrait", "🟦 Portrait"]] as const).map(([val, label]) => {
                      const active = val === "landscape" ? isLandscape : !isLandscape
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            if ((val === "landscape") !== isLandscape) {
                              handleRoomConfigChange({ aspect_ratio: 1 / ratio })
                            }
                          }}
                          className="px-3 py-1.5 transition-colors"
                          style={{
                            background: active ? "var(--color-charcoal)" : "white",
                            color: active ? "white" : "var(--color-subtle)",
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>

                  <label className="flex items-center gap-2" style={{ color: "var(--color-charcoal)" }}>
                    <span className="text-xs font-medium">Ratio</span>
                    <select
                      value={baseRatio}
                      onChange={(e) => {
                        const base = Number(e.target.value)
                        handleRoomConfigChange({ aspect_ratio: isLandscape ? base : 1 / base })
                      }}
                      className="border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2"
                      style={{ borderColor: "var(--color-stone)" }}
                    >
                      <option value={1.33}>4:3</option>
                      <option value={1.5}>3:2</option>
                      <option value={1.78}>16:9</option>
                      <option value={2.0}>2:1</option>
                    </select>
                  </label>
                </>
              )
            })()}
            <label className="flex items-center gap-2" style={{ color: "var(--color-charcoal)" }}>
              <span className="text-xs font-medium">Default shape</span>
              <select
                value={roomConfig?.table_shape ?? "CIRCLE"}
                onChange={(e) => handleRoomConfigChange({ table_shape: e.target.value as RoomConfig["table_shape"] })}
                className="border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2"
                style={{ borderColor: "var(--color-stone)" }}
              >
                <option value="CIRCLE">Circle</option>
                <option value="OVAL">Oval</option>
                <option value="RECTANGLE">Rectangle</option>
              </select>
            </label>
            <label className="flex items-center gap-2" style={{ color: "var(--color-charcoal)" }}>
              <span className="text-xs font-medium">Default seats</span>
              <input
                type="number"
                min={2}
                max={30}
                value={roomConfig?.seats_per_table ?? 10}
                onChange={(e) => handleRoomConfigChange({ seats_per_table: Number(e.target.value) })}
                className="w-16 border rounded px-2 py-1 text-xs bg-white text-center focus:outline-none focus:ring-2"
                style={{ borderColor: "var(--color-stone)" }}
              />
            </label>
            <button
              onClick={handleAutoLayout}
              className="ml-auto border rounded-lg px-4 py-1.5 text-xs transition-colors hover:bg-stone-100"
              style={{ borderColor: "var(--color-stone)", color: "var(--color-subtle)" }}
            >
              Auto Layout
            </button>
          </div>
          {tables.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: "var(--color-subtle)" }}>
              No tables yet. Add tables first.
            </p>
          ) : (
            <div
              className="rounded-xl overflow-hidden border shadow-sm"
              style={{ borderColor: "var(--color-stone)" }}
            >
              <RoomCanvas
                roomConfig={{
                  aspectRatio: roomConfig?.aspect_ratio ?? 1.5,
                  tableShape: roomConfig?.table_shape ?? "CIRCLE",
                  venueCapacity: Math.max(venueCapacity, 10),
                }}
                tables={tables.map((t) => ({
                  id: t.id,
                  name: t.name,
                  capacity: t.capacity,
                  x: t.x,
                  y: t.y,
                  shape: t.shape,
                  seats: t.seats.map((s) => ({ id: s.id, guest_id: s.guest_id })),
                }))}
                onTableMove={handleTableMove}
              />
            </div>
          )}
        </div>
      )}

      {/* Tables management tab */}
      {tab === "tables" && (
        <div className="max-w-2xl">
          {/* Add table form */}
          <form
            onSubmit={handleAddTable}
            className="flex gap-3 mb-6 p-4 rounded-xl border"
            style={{ borderColor: "var(--color-stone)", background: "var(--color-blush)" }}
          >
            <input
              type="text"
              placeholder="Table name…"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--color-stone)" }}
              required
            />
            <select
              value={newTableShape}
              onChange={(e) => setNewTableShape(e.target.value as RoomConfig["table_shape"])}
              className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--color-stone)" }}
              title="Shape"
            >
              <option value="CIRCLE">Circle</option>
              <option value="OVAL">Oval</option>
              <option value="RECTANGLE">Rectangle</option>
            </select>
            <input
              type="number"
              min={2}
              max={30}
              value={newTableCapacity}
              onChange={(e) => setNewTableCapacity(Number(e.target.value))}
              className="w-20 border rounded-lg px-3 py-2 text-sm bg-white text-center focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--color-stone)" }}
              title="Capacity"
            />
            <input
              type="number"
              min={1}
              max={50}
              value={newTableCount}
              onChange={(e) => setNewTableCount(Number(e.target.value))}
              className="w-16 border rounded-lg px-3 py-2 text-sm bg-white text-center focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--color-stone)" }}
              title="How many tables"
            />
            <label className="flex items-center gap-1.5 text-sm whitespace-nowrap" style={{ color: "var(--color-charcoal)" }}>
              <input
                type="checkbox"
                checked={newTableIsHead}
                onChange={(e) => setNewTableIsHead(e.target.checked)}
                className="rounded"
              />
              Head table
            </label>
            <button
              type="submit"
              disabled={addingTable}
              className="text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
              style={{ background: "var(--color-charcoal)" }}
            >
              {addingTable ? "Adding…" : newTableCount > 1 ? `Add ${newTableCount} Tables` : "Add Table"}
            </button>
          </form>

          {/* Table list */}
          <div className="space-y-2">
            {tables.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: "var(--color-subtle)" }}>
                No tables yet. Add your first table above.
              </p>
            )}
            {tables.map((t) => {
              const occupied = t.seats.filter((s) => s.guest_id).length
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white"
                  style={{ borderColor: "var(--color-stone)" }}
                >
                  <div className="flex items-center gap-3">
                    {editingTableId === t.id ? (
                      <input
                        autoFocus
                        value={editingTableName}
                        onChange={(e) => setEditingTableName(e.target.value)}
                        onBlur={() => handleRenameTable(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameTable(t.id)
                          if (e.key === "Escape") setEditingTableId(null)
                        }}
                        className="font-medium text-sm border-b focus:outline-none w-32"
                        style={{ borderColor: "var(--color-charcoal)", color: "var(--color-charcoal)" }}
                      />
                    ) : (
                      <button
                        className="font-medium text-sm hover:underline text-left"
                        style={{ color: "var(--color-charcoal)" }}
                        onClick={() => { setEditingTableId(t.id); setEditingTableName(t.name) }}
                        title="Click to rename"
                      >
                        {t.name}
                      </button>
                    )}
                    {t.is_head_table && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full text-white"
                        style={{ background: "var(--color-pink)" }}
                      >
                        Head
                      </span>
                    )}
                    <span className="text-xs" style={{ color: "var(--color-subtle)" }}>
                      {occupied}/{t.capacity} seats
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteTable(t.id)}
                    className="text-sm px-3 py-1 rounded-lg border transition-colors hover:bg-red-50"
                    style={{ color: "var(--color-warm-red)", borderColor: "var(--color-stone)" }}
                  >
                    Delete
                  </button>
                </div>
              )
            })}
          </div>

          <p className="text-xs mt-4" style={{ color: "var(--color-subtle)" }}>
            {tables.length} table{tables.length !== 1 ? "s" : ""} · {venueCapacity} total seats
          </p>
        </div>
      )}

      {/* Constraints modal */}
      {showConstraints && (
        <ConstraintManager
          guests={seatingGuests}
          constraints={displayConstraints}
          onAdd={handleAddConstraint}
          onDelete={handleDeleteConstraint}
          onClose={() => setShowConstraints(false)}
        />
      )}
    </div>
  )
}
