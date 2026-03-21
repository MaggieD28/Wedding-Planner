"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { getTableSvgDims, getRoomHeight } from "@/lib/roomLayout"

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

export default function RoomCanvas({ roomConfig, tables, overlappingIds, onTableMove, onTableRename }: Props) {
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
    onTableMove(draggingId, pos.x, pos.y)
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
            </g>
          )
        })}
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
