"use client"

import { useRef, useState, useCallback } from "react"
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
  onTableMove: (id: string, x: number, y: number) => void
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

export default function RoomCanvas({ roomConfig, tables, onTableMove }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)

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

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${viewW} 100`}
      style={{ width: "100%", aspectRatio: ratio, display: "block" }}
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
                fill={isDragging ? "#C0736A" : "#EDAFB8"}
                stroke="#B0C4B1"
                strokeWidth="0.5"
                opacity={isDragging ? 0.75 : 1}
              />
            ) : (
              <ellipse
                cx={0} cy={0} rx={rx} ry={ry}
                fill={isDragging ? "#C0736A" : "#EDAFB8"}
                stroke="#B0C4B1"
                strokeWidth="0.5"
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
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {table.name}
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
  )
}
