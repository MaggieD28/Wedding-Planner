"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
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
import GroupManager from "./GroupManager"
import NameTablesModal from "./NameTablesModal"
import { computeConflicts } from "@/lib/seatingConstraints"
import { computeAutoAssign, type GuestForAssign, type TableForAssign, type ConstraintForAssign, type GroupRuleForAssign } from "@/lib/autoAssign"
import { generateAutoFitLayout, detectOverlaps } from "@/lib/roomLayout"
import type { Guest, SeatingTable, Seat, SeatingConstraint, RoomConfig, Group, GroupRule } from "@/types/database"

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

const ROOM_PRESETS = [
  { label: "Ballroom",     aspect_ratio: 1.5,  table_shape: "CIRCLE",    seats_per_table: 10, description: "Classic wedding ballroom · round tables" },
  { label: "Marquee",      aspect_ratio: 2.0,  table_shape: "CIRCLE",    seats_per_table: 10, description: "Wide outdoor tent · round tables" },
  { label: "Barn",         aspect_ratio: 1.78, table_shape: "RECTANGLE", seats_per_table: 12, description: "Rustic barn · long rectangle tables" },
  { label: "Banquet Hall", aspect_ratio: 1.33, table_shape: "OVAL",      seats_per_table: 12, description: "Hotel/formal · oval banquet tables" },
  { label: "Garden",       aspect_ratio: 1.0,  table_shape: "CIRCLE",    seats_per_table: 8,  description: "Square outdoor garden · intimate round tables" },
  { label: "Portrait Hall",aspect_ratio: 0.67, table_shape: "RECTANGLE", seats_per_table: 10, description: "Tall narrow room · rectangle tables" },
] as const

function toSeatingGuest(g: GuestWithHeadTable, allGuests: GuestWithHeadTable[]): SeatingGuest {
  return {
    id: g.id,
    name: `${g.first_name}${g.last_name ? " " + g.last_name : ""}`,
    side: g.side.toUpperCase() as "BRIDE" | "GROOM",
    group: g.side,
    group_id: g.group_id ?? null,
    rsvp_status: g.rsvp_status,
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

  const [guests, setGuests] = useState<GuestWithHeadTable[]>(initialGuests)
  const [tables, setTables] = useState<TableWithSeats[]>(initialTables)
  const [constraints, setConstraints] = useState<ConstraintFull[]>(initialConstraints)
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(initialRoomConfig)
  const [groups, setGroups] = useState<Group[]>([])
  const [groupRules, setGroupRules] = useState<GroupRule[]>([])
  const [filter, setFilter] = useState("")
  const [activeGuest, setActiveGuest] = useState<SeatingGuest | null>(null)
  const [showConstraints, setShowConstraints] = useState(false)
  const [showRoomSetup, setShowRoomSetup] = useState(false)
  const [showCanvas, setShowCanvas] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showNameModal, setShowNameModal] = useState(false)
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [autoAssignResult, setAutoAssignResult] = useState<{ assigned: number; skipped: string[] } | null>(null)
  const [undoToast, setUndoToast] = useState(false)

  // Undo stack — up to 10 reversible operations
  const undoStack = useRef<(() => Promise<void>)[]>([])

  function pushUndo(fn: () => Promise<void>) {
    undoStack.current = [fn, ...undoStack.current].slice(0, 10)
  }

  async function handleUndo() {
    const fn = undoStack.current.shift()
    if (!fn) return
    await fn()
    setUndoToast(true)
    setTimeout(() => setUndoToast(false), 2000)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  })

  // Diagram container measurement
  const diagramRef = useRef<HTMLDivElement>(null)
  const [diagramWidth, setDiagramWidth] = useState(960)
  useEffect(() => {
    const el = diagramRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setDiagramWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  const refreshTables = useCallback(async () => {
    const { data } = await supabase
      .from("seating_tables")
      .select(`*, seats(*, guest:guests(id, first_name, last_name, side, head_guest_id, is_head_table, rsvp_status, group_id))`)
      .order("name")
    if (data) setTables(data as TableWithSeats[])
  }, [supabase])

  const refreshConstraints = useCallback(async () => {
    const { data } = await supabase
      .from("seating_constraints")
      .select(`*, guest_a:guests!seating_constraints_guest_a_id_fkey(id, first_name, last_name, side, head_guest_id, is_head_table, rsvp_status, group_id), guest_b:guests!seating_constraints_guest_b_id_fkey(id, first_name, last_name, side, head_guest_id, is_head_table, rsvp_status, group_id)`)
    if (data) setConstraints(data as ConstraintFull[])
  }, [supabase])

  const refreshGuests = useCallback(async () => {
    const { data } = await supabase
      .from("guests")
      .select("id, guest_id, first_name, last_name, side, head_guest_id, is_head_table, rsvp_status, group_id, rsvp_synced, save_the_date_sent, invite_sent, invite_date, rsvp_date, dietary_requirement, allergies_notes, children_count, children_dietary, children_allergies, follow_up_notes, email, phone, created_at, updated_at")
      .order("last_name")
    if (data) setGuests(data as GuestWithHeadTable[])
  }, [supabase])

  const refreshGroups = useCallback(async () => {
    const { data: g } = await supabase.from("groups").select("*").order("name")
    if (g) setGroups(g as Group[])
    const { data: r } = await supabase.from("group_rules").select("*")
    if (r) setGroupRules(r as GroupRule[])
  }, [supabase])

  // Initial load of groups
  useEffect(() => {
    refreshGroups()
  }, [refreshGroups])

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("seating-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "seats" }, refreshTables)
      .on("postgres_changes", { event: "*", schema: "public", table: "seating_tables" }, refreshTables)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, refreshGroups)
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, () => {
        refreshGuests()
        refreshTables()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, refreshTables, refreshGroups, refreshGuests])

  // Derived state
  const displayTables = buildDisplayTables(tables, guests)
  const seatingGuests = guests.map((g) => toSeatingGuest(g, guests))

  // guestGroupMap for conflict detection
  const guestGroupMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of guests) {
      if (g.group_id) m.set(g.id, g.group_id)
    }
    return m
  }, [guests])

  // Identify the couple
  const brideGuest = seatingGuests.find((g) => g.name.toLowerCase().startsWith("maggie") && g.side === "BRIDE")
  const groomGuest = seatingGuests.find((g) => g.name.toLowerCase().startsWith("bobby") && g.side === "GROOM")
  const coupleIds = new Set([brideGuest?.id, groomGuest?.id].filter(Boolean) as string[])

  const assignedGuestIds = new Set(
    tables.flatMap((t) => t.seats.map((s) => s.guest_id).filter(Boolean))
  )
  const unassignedGuests = seatingGuests.filter((g) => !assignedGuestIds.has(g.id) && !coupleIds.has(g.id))

  const { avoidViolations, preferWarnings, groupViolations, groupWarnings } = computeConflicts(
    tables.map((t) => ({
      id: t.id,
      x: t.x,
      y: t.y,
      seats: t.seats.map((s) => ({ id: s.id, guest_id: s.guest_id })),
    })),
    constraints.map((c) => ({
      id: c.id,
      guest_a_id: c.guest_a_id,
      guest_b_id: c.guest_b_id,
      type: c.type,
    })),
    groupRules.map((r) => ({
      id: r.id,
      type: r.type,
      group_id: r.group_id,
      target_group_id: r.target_group_id,
      target_table_id: r.target_table_id,
    })),
    guestGroupMap
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

    const currentSeatId = tables
      .flatMap((t) => t.seats)
      .find((s) => s.guest_id === guestId)?.id

    const prevOccupant = tables
      .flatMap((t) => t.seats)
      .find((s) => s.id === targetSeatId)?.guest_id ?? null

    if (currentSeatId === targetSeatId) return

    pushUndo(async () => {
      if (currentSeatId) {
        await supabase.from("seats").update({ guest_id: guestId }).eq("id", currentSeatId)
      } else {
        await supabase.from("seats").update({ guest_id: null }).eq("id", targetSeatId)
      }
      if (prevOccupant) {
        await supabase.from("seats").update({ guest_id: prevOccupant }).eq("id", targetSeatId)
      }
      await refreshTables()
    })

    if (currentSeatId) {
      await supabase.from("seats").update({ guest_id: null }).eq("id", currentSeatId)
    }
    await supabase.from("seats").update({ guest_id: guestId }).eq("id", targetSeatId)
    await refreshTables()
  }

  const handleUnassignGuest = async (seatId: string) => {
    const guestId = tables.flatMap((t) => t.seats).find((s) => s.id === seatId)?.guest_id
    pushUndo(async () => {
      if (guestId) await supabase.from("seats").update({ guest_id: guestId }).eq("id", seatId)
      await refreshTables()
    })
    await supabase.from("seats").update({ guest_id: null }).eq("id", seatId)
    await refreshTables()
  }

  const handleClearTable = async (tableId: string) => {
    const seatIds = tables.find((t) => t.id === tableId)?.seats.map((s) => s.id) ?? []
    if (seatIds.length === 0) return

    const prevAssignments = tables
      .find((t) => t.id === tableId)
      ?.seats.filter((s) => s.guest_id)
      .map((s) => ({ seatId: s.id, guestId: s.guest_id! })) ?? []

    pushUndo(async () => {
      for (const { seatId, guestId } of prevAssignments) {
        await supabase.from("seats").update({ guest_id: guestId }).eq("id", seatId)
      }
      await refreshTables()
    })

    await supabase.from("seats").update({ guest_id: null }).in("id", seatIds)
    await refreshTables()
  }

  const handleMoveGuest = async (guestId: string, fromSeatId: string, toSeatId: string) => {
    pushUndo(async () => {
      await supabase.from("seats").update({ guest_id: guestId }).eq("id", fromSeatId)
      await supabase.from("seats").update({ guest_id: null }).eq("id", toSeatId)
      await refreshTables()
    })
    await supabase.from("seats").update({ guest_id: null }).eq("id", fromSeatId)
    await supabase.from("seats").update({ guest_id: guestId }).eq("id", toSeatId)
    await refreshTables()
  }

  const handleRsvpChange = async (guestId: string, status: string) => {
    await supabase.from("guests").update({ rsvp_status: status }).eq("id", guestId)
    if (status === "Declined") {
      const seat = tables.flatMap((t) => t.seats).find((s) => s.guest_id === guestId)
      if (seat) await supabase.from("seats").update({ guest_id: null }).eq("id", seat.id)
    }
    await refreshGuests()
    await refreshTables()
  }

  const handleSyncRsvps = async () => {
    const res = await fetch("/api/sync-rsvps", { method: "POST" })
    if (res.ok) {
      await refreshGuests()
      for (const g of guests.filter((x) => x.rsvp_status === "Declined")) {
        const seat = tables.flatMap((t) => t.seats).find((s) => s.guest_id === g.id)
        if (seat) await supabase.from("seats").update({ guest_id: null }).eq("id", seat.id)
      }
      await refreshTables()
    }
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
    const unassignedForAssign: GuestForAssign[] = unassignedGuests.map((g) => {
      const raw = guests.find((r) => r.id === g.id)
      return {
        id: g.id,
        name: g.name,
        side: g.side,
        last_name: raw?.last_name ?? null,
        group_id: g.group_id ?? null,
        is_head_table: g.is_head_table,
        head_guest_id: g.head_guest_id,
        hasPlusOne: g.hasPlusOne,
      }
    })

    const tablesForAssign: TableForAssign[] = tables.map((t) => ({
      id: t.id,
      is_head_table: t.is_head_table,
      x: t.x,
      y: t.y,
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

    const groupRulesForAssign: GroupRuleForAssign[] = groupRules.map((r) => ({
      type: r.type,
      group_id: r.group_id,
      target_group_id: r.target_group_id,
      target_table_id: r.target_table_id,
    }))

    const { assignments, skipped } = computeAutoAssign(
      unassignedForAssign,
      tablesForAssign,
      constraintsForAssign,
      tableId,
      groupRulesForAssign
    )

    for (const { seatId, guestId } of assignments) {
      await supabase.from("seats").update({ guest_id: guestId }).eq("id", seatId)
    }

    await refreshTables()
    return { assigned: assignments.length, skipped }
  }

  // --- Constraint handlers ---
  const handleAddConstraint = async (guestAId: string, guestBId: string, type: "AVOID" | "PREFER") => {
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

  // --- Group handlers ---
  const handleCreateGroup = async (name: string, colour: string) => {
    await supabase.from("groups").insert({ name, colour })
    await refreshGroups()
  }

  const handleRenameGroup = async (id: string, name: string) => {
    await supabase.from("groups").update({ name }).eq("id", id)
    await refreshGroups()
  }

  const handleDeleteGroup = async (id: string) => {
    await supabase.from("groups").delete().eq("id", id)
    await refreshGroups()
    await refreshGuests()
  }

  const handleAssignGroup = async (guestId: string, groupId: string | null) => {
    await supabase.from("guests").update({ group_id: groupId }).eq("id", guestId)
    await refreshGuests()
    await refreshTables()
  }

  // --- Room canvas ---
  const handleTableMove = async (id: string, x: number, y: number) => {
    await supabase.from("seating_tables").update({ x, y }).eq("id", id)
    await refreshTables()
  }

  const handleAutoLayout = async () => {
    if (tables.length === 0) return
    const positions = generateAutoFitLayout(
      tables.map((t) => ({ capacity: t.capacity, shape: t.shape })),
      roomConfig?.aspect_ratio ?? 1.5,
      Math.max(venueCapacity, 10),
      roomConfig?.table_shape ?? "CIRCLE"
    )
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

  const handleRenameTable = async (tableId: string, name?: string) => {
    const n = (name ?? editingTableName).trim()
    if (n) {
      await supabase.from("seating_tables").update({ name: n }).eq("id", tableId)
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

  const handleApplyTableNames = async (updates: { id: string; name: string }[]) => {
    for (const { id, name } of updates) {
      await supabase.from("seating_tables").update({ name }).eq("id", id)
    }
    await refreshTables()
  }

  const venueCapacity = tables.reduce((s, t) => s + t.capacity, 0)

  const diagramPositions = useMemo(() => {
    const n = displayTables.length
    if (n === 0) return {} as Record<string, { x: number; y: number }>
    const ratio = roomConfig?.aspect_ratio ?? 1.5
    const containerH = diagramWidth / ratio
    const sizes = displayTables.map((t) => Math.max(200, 200 + (t.seats.length - 6) * 8) + 48)
    const maxSize = Math.max(...sizes)
    const gap = 24
    const cellPx = maxSize + gap
    let bestR = 1, bestC = n, bestScore = Infinity
    for (let r = 1; r <= n; r++) {
      const c = Math.ceil(n / r)
      const score = Math.abs((c * cellPx) / (r * cellPx) - ratio)
      if (score < bestScore) { bestScore = score; bestR = r; bestC = c }
    }
    const totalW = bestC * cellPx
    const totalH = bestR * cellPx
    const startX = Math.max(cellPx / 2, (diagramWidth - totalW) / 2 + cellPx / 2)
    const startY = Math.max(cellPx / 2, (containerH - totalH) / 2 + cellPx / 2)
    const result: Record<string, { x: number; y: number }> = {}
    displayTables.forEach((t, i) => {
      const row = Math.floor(i / bestC)
      const col = i % bestC
      result[t.id] = {
        x: Math.min(95, Math.max(5, ((startX + col * cellPx) / diagramWidth) * 100)),
        y: Math.min(95, Math.max(5, ((startY + row * cellPx) / containerH) * 100)),
      }
    })
    return result
  }, [displayTables, diagramWidth, roomConfig?.aspect_ratio])

  const overlappingTableIds = detectOverlaps(
    tables.map((t) => ({ id: t.id, x: t.x, y: t.y, capacity: t.capacity, shape: t.shape })),
    roomConfig?.aspect_ratio ?? 1.5,
    Math.max(venueCapacity, 10),
    roomConfig?.table_shape ?? "CIRCLE"
  )

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
            onClick={() => setShowRoomSetup(true)}
            className="border rounded-lg px-3 py-2 text-sm transition-colors hover:bg-stone-100"
            style={{ borderColor: "var(--color-stone)", color: "var(--color-subtle)" }}
            title="Room Setup"
          >
            ⚙
          </button>
          <button
            onClick={() => setShowCanvas((v) => !v)}
            className="border rounded-lg px-3 py-2 text-sm transition-colors hover:bg-stone-100"
            style={{
              borderColor: showCanvas ? "var(--color-charcoal)" : "var(--color-stone)",
              background: showCanvas ? "var(--color-charcoal)" : "white",
              color: showCanvas ? "white" : "var(--color-subtle)",
            }}
            title={showCanvas ? "Hide room canvas" : "Show room canvas"}
          >
            ⊞
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

      {/* Seating content */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* Canvas panel (collapsible) */}
          {showCanvas && (
            <div
              className="border-b mb-4"
              style={{
                height: "340px",
                borderColor: "var(--color-stone)",
                transition: "height 0.25s ease",
              }}
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
                overlappingIds={overlappingTableIds}
                onTableMove={handleTableMove}
                onTableRename={(id, name) => handleRenameTable(id, name)}
                allTables={tables.map(t => ({ id: t.id, x: t.x, y: t.y, capacity: t.capacity, shape: t.shape }))}
                venueCapacity={venueCapacity}
                displayTables={displayTables}
                avoidViolations={avoidViolations}
              />
            </div>
          )}

          <div className="flex gap-4 items-start">
            {/* Sidebar */}
            <div
              className={`flex-shrink-0 rounded-xl shadow-sm border sticky top-6 self-start max-h-[90vh] overflow-y-auto transition-all duration-200 ${sidebarOpen ? "w-64 p-4" : "w-10"}`}
              style={{ background: "var(--color-blush)", borderColor: "var(--color-stone)" }}
            >
              {sidebarOpen ? (
                <>
                  {/* Sidebar close button */}
                  <div className="flex justify-end mb-3">
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="text-sm px-2 py-1 rounded hover:bg-stone-200 transition-colors"
                      style={{ color: "var(--color-subtle)" }}
                      title="Collapse sidebar"
                    >
                      ‹
                    </button>
                  </div>

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

              {/* Guest list with RSVP sections */}
              <GuestList
                guests={unassignedGuests}
                allGuests={seatingGuests}
                filter={filter}
                onFilterChange={setFilter}
                groups={groups}
                onRsvpChange={handleRsvpChange}
                onSyncRsvps={handleSyncRsvps}
                onAssignGroup={handleAssignGroup}
              />

              {/* Group Manager */}
              <GroupManager
                groups={groups}
                guests={seatingGuests}
                onCreateGroup={handleCreateGroup}
                onRenameGroup={handleRenameGroup}
                onDeleteGroup={handleDeleteGroup}
                onAssignGroup={handleAssignGroup}
              />
                </>
              ) : (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="w-full h-full flex items-center justify-center text-sm transition-colors"
                  style={{ color: "var(--color-subtle)" }}
                  title="Expand sidebar"
                >
                  ›
                </button>
              )}
            </div>

            {/* Table grid - always cards */}
            <div className="flex-1 overflow-y-auto">
              {displayTables.length === 0 ? (
                <div
                  className="flex items-center justify-center h-full text-sm"
                  style={{ color: "var(--color-subtle)" }}
                >
                  No tables yet. Add tables in the Setup menu.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {displayTables.map((table) => (
                    <TableCard
                      key={table.id}
                      table={table}
                      avoidViolations={avoidViolations}
                      preferWarnings={preferWarnings}
                      groupViolations={groupViolations}
                      groupWarnings={groupWarnings}
                      otherTables={displayTables.filter((t) => t.id !== table.id)}
                      onUnassignGuest={handleUnassignGuest}
                      onClearTable={handleClearTable}
                      onAutoFillTable={handleAutoFillTable}
                      onRenameTable={handleRenameTable}
                      onMoveGuest={handleMoveGuest}
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

      {/* Setup modal (room config + table management) */}
      {showRoomSetup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div
            className="bg-white rounded-xl shadow-lg max-w-lg overflow-y-auto max-h-[85vh] relative"
            style={{ borderColor: "var(--color-stone)" }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowRoomSetup(false)}
              className="absolute top-4 right-4 text-xl"
              style={{ color: "var(--color-subtle)" }}
              title="Close"
            >
              ×
            </button>

            <div className="p-6">
              {/* Section 1: Venue & Room Configuration */}
              <div className="mb-6">
                <h3
                  className="text-lg font-semibold mb-4"
                  style={{ color: "var(--color-charcoal)" }}
                >
                  Venue & Room Configuration
                </h3>

                <div className="space-y-4">
                  <label className="flex items-center gap-2" style={{ color: "var(--color-charcoal)" }}>
                    <span className="text-xs font-medium">Venue preset</span>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const preset = ROOM_PRESETS.find((p) => p.label === e.target.value)
                        if (preset) handleRoomConfigChange({
                          aspect_ratio: preset.aspect_ratio,
                          table_shape: preset.table_shape as RoomConfig["table_shape"],
                          seats_per_table: preset.seats_per_table,
                        })
                        e.target.value = ""
                      }}
                      className="border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2"
                      style={{ borderColor: "var(--color-stone)" }}
                    >
                      <option value="" disabled>Choose…</option>
                      {ROOM_PRESETS.map((p) => (
                        <option key={p.label} value={p.label} title={p.description}>{p.label}</option>
                      ))}
                    </select>
                  </label>

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
                                className="flex-1 px-3 py-1.5 transition-colors"
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
                </div>
              </div>

              {/* Section 2: Manage Tables */}
              <div className="border-t pt-6" style={{ borderColor: "var(--color-stone)" }}>
                <h3
                  className="text-lg font-semibold mb-4"
                  style={{ color: "var(--color-charcoal)" }}
                >
                  Manage Tables
                </h3>

                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => setShowNameModal(true)}
                    disabled={tables.length === 0}
                    className="border rounded-lg px-4 py-2 text-sm transition-colors hover:bg-stone-50 disabled:opacity-40"
                    style={{ borderColor: "var(--color-stone)", color: "var(--color-charcoal)" }}
                  >
                    ✦ Name by theme…
                  </button>
                </div>

                <form
                  onSubmit={handleAddTable}
                  className="flex flex-col gap-2 mb-4 p-3 rounded-lg border"
                  style={{ borderColor: "var(--color-stone)", background: "var(--color-blush)" }}
                >
                  <input
                    type="text"
                    placeholder="Table name…"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2"
                    style={{ borderColor: "var(--color-stone)" }}
                    required
                  />
                  <div className="flex gap-2">
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
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-charcoal)" }}>
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
                      className="text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50 ml-auto"
                      style={{ background: "var(--color-charcoal)" }}
                    >
                      {addingTable ? "Adding…" : newTableCount > 1 ? `Add ${newTableCount}` : "Add Table"}
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  {tables.length === 0 && (
                    <p className="text-sm text-center py-4" style={{ color: "var(--color-subtle)" }}>
                      No tables yet. Add your first table above.
                    </p>
                  )}
                  {tables.map((t) => {
                    const occupied = t.seats.filter((s) => s.guest_id).length
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-white text-sm"
                        style={{ borderColor: "var(--color-stone)" }}
                      >
                        <div className="flex items-center gap-2 flex-1">
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
                              className="font-medium text-sm border-b focus:outline-none flex-1"
                              style={{ borderColor: "var(--color-charcoal)", color: "var(--color-charcoal)" }}
                            />
                          ) : (
                            <button
                              className="font-medium text-sm hover:underline text-left flex-1"
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
                            {occupied}/{t.capacity}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteTable(t.id)}
                          className="text-xs px-3 py-1 rounded-lg border transition-colors hover:bg-red-50"
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
            </div>
          </div>
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

      {/* Name tables modal */}
      {showNameModal && (
        <NameTablesModal
          tables={displayTables}
          onApply={handleApplyTableNames}
          onClose={() => setShowNameModal(false)}
        />
      )}

      {/* Undo toast */}
      {undoToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-white text-sm shadow-lg z-50 pointer-events-none"
          style={{ background: "var(--color-charcoal)" }}
        >
          Undone
        </div>
      )}
    </div>
  )
}
