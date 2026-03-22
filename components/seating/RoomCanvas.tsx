"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { getTableSvgDims, getRoomHeight, detectOverlaps } from "@/lib/roomLayout"
import type { DisplayTable } from "./TableCard"

export type RoomTable = {
  id: string
  name: string
  capacity: number
  x: number | null
  y: number | null
  shape: string | null
  seats: { id: string; guest_id: string | null }[]
}

type RoomConfig = {
  aspectRatio: number
  tableShape: string
  venueCapacity: number
}

type Props = {
  roomConfig: RoomConfig
  tables: RoomTable[]
  overlappingIds?: Set<string>
  onTableMove: (id: string, x: number, y: number) => void
  onTableRename?: (id: string, name: string) => Promise<void>
  allTables?: { id: string; x: number | null; y: number | null; capacity: number; shape: string | null }[]
  venueCapacity?: number
  displayTables?: DisplayTable[]
  avoidViolations?: Set<string>
}

function findFreePosition(
  tableId: string,
  proposed: { x: number; y: number },
  allTables: Array<{ id: string; x: number | null; y: number | null; capacity: number; shape: string | null }>,
  aspectRatio: number,
  venueCapacity: number,
  tableShape: string
): { x: number; y: number } {
  // Build a temp snapshot with the dragged table at the proposed position
  const tempTables = allTables.map((t) =>
    t.id === tableId
      ? { ...t, x: proposed.x, y: proposed.y }
      : t
  )

  // Call detectOverlaps — if tableId is NOT in the result, return proposed immediately
  const overlapping = detectOverlaps(tempTables, aspectRatio, venueCapacity, tableShape)
  if (!overlapping.has(tableId)) {
    return proposed
  }

  // Otherwise, spiral outward: try offsets of [±5, ±10, ±15, ±20, ±25]% in x and y
  const offsets = [5, 10, 15, 20, 25]
  for (const offsetX of offsets) {
    for (const offsetY of offsets) {
      // Try all 4 directions
      const candidates = [
        { x: proposed.x + offsetX, y: proposed.y + offsetY },
        { x: proposed.x + offsetX, y: proposed.y - offsetY },
        { x: proposed.x - offsetX, y: proposed.y + offsetY },
        { x: proposed.x - offsetX, y: proposed.y - offsetY },
      ]

      for (const candidate of candidates) {
        const clamped = {
          x: Math.max(5, Math.min(95, candidate.x)),
          y: Math.max(5, Math.min(95, candidate.y)),
        }
        const testTables = allTables.map((t) =>
          t.id === tableId ? { ...t, x: clamped.x, y: clamped.y } : t
        )
        const testOverlapping = detectOverlaps(testTables, aspectRatio, venueCapacity, tableShape)
        if (!testOverlapping.has(tableId)) {
          return clamped
        }
      }
    }
  }

  // Return clamped proposed if no clear spot found
  return {
    x: Math.max(5, Math.min(95, proposed.x)),
    y: Math.max(5, Math.min(95, proposed.y)),
  }
}

function FlowerWatermark({ cx, cy }: { cx: number; cy: number }) {
  const petals = 5
  const r = 12
  const pr = 5
  return (
    <g opacity={0.06}>
      {Array.from({ length: petals }).map((_, i) => {
        const angle = (i / petals) * Math.PI * 2 - Math.PI / 2
        const px = cx + Math.cos(angle) * r
        const py = cy + Math.sin(angle) * r
        return (
          <ellipse
            key={i}
            cx={px}
            cy={py}
            rx={pr}
            ry={pr * 0.55}
            transform={`rotate(${(angle * 180) / Math.PI + 90}, ${px}, ${py})`}
            fill="#EDAFB8"
          />
        )
      })}
      <circle cx={cx} cy={cy} r="3.5" fill="#B0C4B1" />
    </g>
  )
}

export default function RoomCanvas({ roomConfig, tables, overlappingIds, onTableMove, onTableRename, allTables, venueCapacity, displayTables, avoidViolations }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)

  // Zoom + pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const lastTouchDist = useRef<number | null>(null)
  const isPanning = useRef(false)
  const lastPanPos = useRef<{ x: number; y: number } | null>(null)

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renamePos, setRenamePos] = useState<{ x: number; y: number } | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  const ratio = roomConfig.aspectRatio
  const roomHeight = getRoomHeight(roomConfig.venueCapacity, ratio)
  const viewW = ratio * 100

  const toPercentCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 50, y: 50 }
    const rect = svg.getBoundingClientRect()
    return {
      x: Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100)),
    }
  }, [])

  // Mouse wheel zoom (Ctrl+scroll)
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom((z) => Math.max(0.5, Math.min(3, z - e.deltaY * 0.002)))
    }
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [])

  // Touch handlers for pinch-to-zoom
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchDist.current = Math.sqrt(dx * dx + dy * dy)
    } else if (e.touches.length === 1 && !draggingId) {
      isPanning.current = true
      lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && lastTouchDist.current != null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const delta = dist - lastTouchDist.current
      setZoom((z) => Math.max(0.5, Math.min(3, z + delta * 0.005)))
      lastTouchDist.current = dist
    } else if (e.touches.length === 1 && isPanning.current && lastPanPos.current) {
      const dx = e.touches[0].clientX - lastPanPos.current.x
      const dy = e.touches[0].clientY - lastPanPos.current.y
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
      lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  function handleTouchEnd() {
    lastTouchDist.current = null
    isPanning.current = false
    lastPanPos.current = null
  }

  const handlePointerDown = (e: React.PointerEvent, tableId: string) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setDraggingId(tableId)
    setDragPos(toPercentCoords(e.clientX, e.clientY))
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingId) return
    setDragPos(toPercentCoords(e.clientX, e.clientY))
  }

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingId) return
    const pos = toPercentCoords(e.clientX, e.clientY)
    const aspectRatio = roomConfig?.aspectRatio ?? 1.5
    const tableShape = roomConfig?.tableShape ?? "CIRCLE"
    const resolvedPos = allTables && venueCapacity !== undefined
      ? findFreePosition(draggingId, pos, allTables, aspectRatio, venueCapacity, tableShape)
      : pos
    onTableMove(draggingId, resolvedPos.x, resolvedPos.y)
    setDraggingId(null)
    setDragPos(null)
  }

  function handleLabelDoubleClick(e: React.MouseEvent, table: RoomTable) {
    if (!onTableRename) return
    e.stopPropagation()
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const pctX = table.x ?? 50
    const pctY = table.y ?? 50
    const px = (pctX / 100) * rect.width + rect.left
    const py = (pctY / 100) * rect.height + rect.top
    setRenamingId(table.id)
    setRenameValue(table.name)
    setRenamePos({ x: px, y: py })
    setTimeout(() => renameRef.current?.focus(), 0)
  }

  async function saveRename() {
    if (renamingId && renameValue.trim() && onTableRename) {
      await onTableRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", overflow: "hidden" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewW} 100`}
        style={{
          width: "100%",
          aspectRatio: ratio,
          display: "block",
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transformOrigin: "center center",
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Room boundary */}
        <rect
          x="1" y="1" width={viewW - 2} height="98" rx="2"
          fill="#FAF6F0"
          stroke="#DEDBD2"
          strokeWidth="0.5"
          strokeDasharray="2 1"
        />
        <FlowerWatermark cx={viewW / 2} cy={50} />

        {/* Tables */}
        {tables.map((table) => {
          const pctX = draggingId === table.id && dragPos ? dragPos.x : (table.x ?? 50)
          const pctY = draggingId === table.id && dragPos ? dragPos.y : (table.y ?? 50)
          const xSvg = pctX * ratio
          const ySvg = pctY

          const shape = (table.shape ?? roomConfig.tableShape).toUpperCase()
          const { rx, ry } = getTableSvgDims(table.capacity, shape, roomHeight)
          const occupied = table.seats.filter((s) => s.guest_id).length
          const isDragging = draggingId === table.id
          const isOverlapping = overlappingIds?.has(table.id) ?? false

          const fill = isDragging ? "#C0736A" : "#EDAFB8"
          const stroke = isOverlapping ? "#f59e0b" : "#B0C4B1"
          const strokeWidth = isOverlapping ? "1" : "0.5"

          // Find the corresponding display table for seat data
          const displayTable = displayTables?.find((dt) => dt.id === table.id)
          const seats = displayTable?.seats ?? []

          return (
            <g
              key={table.id}
              transform={`translate(${xSvg}, ${ySvg})`}
              style={{ cursor: isDragging ? "grabbing" : "grab" }}
              onPointerDown={(e) => handlePointerDown(e, table.id)}
            >
              {shape === "RECTANGLE" ? (
                <rect
                  x={-rx} y={-ry} width={rx * 2} height={ry * 2} rx="1"
                  fill={fill} stroke={stroke} strokeWidth={strokeWidth}
                  opacity={isDragging ? 0.75 : 1}
                />
              ) : (
                <ellipse
                  cx={0} cy={0} rx={rx} ry={ry}
                  fill={fill} stroke={stroke} strokeWidth={strokeWidth}
                  opacity={isDragging ? 0.75 : 1}
                />
              )}
              <text
                x={0} y={-0.6}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="2"
                fill="#4A5759"
                fontWeight="600"
                style={{ pointerEvents: onTableRename ? "all" : "none", userSelect: "none", cursor: "text" }}
                onDoubleClick={(e) => handleLabelDoubleClick(e, table)}
              >
                {renamingId === table.id ? "" : table.name}
              </text>
              <text
                x={0} y={1.6}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="1.5"
                fill="#6B7E80"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {occupied}/{table.capacity}
              </text>

              {/* Seat pins (guest names on colored dots) */}
              {displayTable && seats.length > 0 && (
                <g style={{ pointerEvents: "none" }}>
                  {shape === "RECTANGLE" ? (
                    // Rectangle table: seats along top and bottom edges
                    (() => {
                      const n = seats.length
                      const topCount = Math.ceil(n / 2)
                      const topSeats = seats.slice(0, topCount)
                      const bottomSeats = seats.slice(topCount)
                      const spacing = (rx * 2) / (topCount + 1)

                      return (
                        <>
                          {/* Top seats */}
                          {topSeats.map((seat, i) => {
                            const sx = -rx + spacing * (i + 1)
                            const sy = -ry - 1.4
                            const guest = seat.guest
                            const isConflict = avoidViolations?.has(seat.id) ?? false
                            const dotColor = isConflict
                              ? "#C0736A"
                              : !guest
                              ? "#DEDBD2"
                              : guest.side === "BRIDE"
                              ? "#EDAFB8"
                              : "#B0C4B1"

                            return (
                              <g key={seat.id}>
                                <circle cx={sx} cy={sy} r={0.35} fill={dotColor} />
                                <text
                                  x={sx}
                                  y={sy - 0.6}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fontSize="0.4"
                                  fontWeight="500"
                                  fill="#4A5759"
                                  style={{ userSelect: "none" }}
                                >
                                  {guest ? guest.name.split(" ")[0].slice(0, 8) : "—"}
                                </text>
                              </g>
                            )
                          })}
                          {/* Bottom seats */}
                          {bottomSeats.map((seat, i) => {
                            const spacing = (rx * 2) / (bottomSeats.length + 1)
                            const sx = -rx + spacing * (i + 1)
                            const sy = ry + 1.4
                            const guest = seat.guest
                            const isConflict = avoidViolations?.has(seat.id) ?? false
                            const dotColor = isConflict
                              ? "#C0736A"
                              : !guest
                              ? "#DEDBD2"
                              : guest.side === "BRIDE"
                              ? "#EDAFB8"
                              : "#B0C4B1"

                            return (
                              <g key={seat.id}>
                                <circle cx={sx} cy={sy} r={0.35} fill={dotColor} />
                                <text
                                  x={sx}
                                  y={sy + 0.6}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fontSize="0.4"
                                  fontWeight="500"
                                  fill="#4A5759"
                                  style={{ userSelect: "none" }}
                                >
                                  {guest ? guest.name.split(" ")[0].slice(0, 8) : "—"}
                                </text>
                              </g>
                            )
                          })}
                        </>
                      )
                    })()
                  ) : (
                    // Round table: seats radiating around
                    seats.map((seat, i) => {
                      const n = seats.length
                      const angle = (2 * Math.PI * i) / n - Math.PI / 2
                      const orbitRadius = rx + 1.8
                      const sx = orbitRadius * Math.cos(angle)
                      const sy = orbitRadius * Math.sin(angle)

                      const guest = seat.guest
                      const isConflict = avoidViolations?.has(seat.id) ?? false
                      const dotColor = isConflict
                        ? "#C0736A"
                        : !guest
                        ? "#DEDBD2"
                        : guest.side === "BRIDE"
                        ? "#EDAFB8"
                        : "#B0C4B1"

                      return (
                        <g key={seat.id}>
                          <circle cx={sx} cy={sy} r={0.35} fill={dotColor} />
                          <text
                            x={sx}
                            y={sy + (sy < 0 ? -0.6 : 0.6)}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="0.4"
                            fontWeight="500"
                            fill="#4A5759"
                            style={{ userSelect: "none" }}
                          >
                            {guest ? guest.name.split(" ")[0].slice(0, 8) : "—"}
                          </text>
                        </g>
                      )
                    })
                  )}
                </g>
              )}
            </g>
          )
        })}

        {/* Legend */}
        <g style={{ pointerEvents: "none" }}>
          <rect x="2" y="82" width="28" height="14" rx="2" fill="white" opacity="0.9" />
          <circle cx="4" cy="86" r="0.4" fill="#EDAFB8" />
          <text x="5.5" y="86.5" fontSize="0.65" fontWeight="500" fill="#4A5759" style={{ userSelect: "none" }}>Bride</text>
          <circle cx="12" cy="86" r="0.4" fill="#B0C4B1" />
          <text x="13.5" y="86.5" fontSize="0.65" fontWeight="500" fill="#4A5759" style={{ userSelect: "none" }}>Groom</text>
          <circle cx="20" cy="86" r="0.4" fill="#DEDBD2" />
          <text x="21.5" y="86.5" fontSize="0.65" fontWeight="500" fill="#4A5759" style={{ userSelect: "none" }}>Empty</text>
          <circle cx="27" cy="86" r="0.4" fill="#C0736A" />
          <text x="28.5" y="86.5" fontSize="0.65" fontWeight="500" fill="#4A5759" style={{ userSelect: "none" }}>Conflict</text>
        </g>
      </svg>

      {/* Inline rename input overlay */}
      {renamingId && renamePos && (
        <input
          ref={renameRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={saveRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveRename()
            if (e.key === "Escape") setRenamingId(null)
          }}
          style={{
            position: "fixed",
            left: renamePos.x - 60,
            top: renamePos.y - 12,
            width: 120,
            fontSize: 12,
            textAlign: "center",
            background: "white",
            border: "1px solid var(--color-charcoal)",
            borderRadius: 4,
            padding: "2px 4px",
            zIndex: 50,
          }}
        />
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-2 right-2 flex gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
          className="w-7 h-7 flex items-center justify-center rounded border bg-white text-sm shadow-sm hover:bg-stone-50"
          style={{ borderColor: "var(--color-stone)", color: "var(--color-charcoal)" }}
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
          className="w-7 h-7 flex items-center justify-center rounded border bg-white text-xs shadow-sm hover:bg-stone-50"
          style={{ borderColor: "var(--color-stone)", color: "var(--color-subtle)" }}
          title="Reset zoom"
        >
          ⊙
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
          className="w-7 h-7 flex items-center justify-center rounded border bg-white text-sm shadow-sm hover:bg-stone-50"
          style={{ borderColor: "var(--color-stone)", color: "var(--color-charcoal)" }}
          title="Zoom out"
        >
          −
        </button>
      </div>
    </div>
  )
}
