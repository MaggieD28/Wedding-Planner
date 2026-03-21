export interface RoomLayoutConfig {
  roomShape: string
  aspectRatio: number
  tableShape: string
  seatsPerTable: number
  guestCount: number
  venueCapacity: number
}

export interface Position {
  x: number
  y: number
}

/**
 * Compute table dimensions in SVG units.
 * The SVG viewBox is [0, ratio*100] × [0, 100], and 1 SVG unit = roomHeight/100 metres.
 *
 * Table dimensions from dimensions.com references:
 *   Circle:    diameter = 0.3 + 0.15 × seats  metres
 *   Oval:      length   = 1.0 + 0.145 × seats metres, width = 1.07 m
 *   Rectangle: length   = 1.0 + 0.145 × seats metres, width = 0.91 m
 */
export function getTableSvgDims(
  capacity: number,
  shape: string,
  roomHeight: number
): { rx: number; ry: number } {
  const s = shape.toUpperCase()
  if (s === "CIRCLE") {
    const diameter = 0.3 + 0.15 * capacity
    const r = (diameter / 2 / roomHeight) * 100
    return { rx: r, ry: r }
  }
  if (s === "OVAL") {
    const length = 1.0 + 0.145 * capacity
    const width = 1.07
    return {
      rx: (length / 2 / roomHeight) * 100,
      ry: (width / 2 / roomHeight) * 100,
    }
  }
  // RECTANGLE
  const length = 1.0 + 0.145 * capacity
  const width = 0.91
  return {
    rx: (length / 2 / roomHeight) * 100,
    ry: (width / 2 / roomHeight) * 100,
  }
}

/**
 * Compute room height in metres given venue capacity and aspect ratio.
 * Area = venueCapacity × 2 m² (2 m² per person is a standard allowance).
 */
export function getRoomHeight(venueCapacity: number, aspectRatio: number): number {
  const area = Math.max(venueCapacity, 1) * 2
  return Math.sqrt(area / aspectRatio)
}

/**
 * Generate grid positions (as 0–100 percentages in both axes) for `tableCount` tables.
 * Uses room-config defaults for all tables (legacy — prefer generateAutoFitLayout).
 */
export function generateLayout(config: RoomLayoutConfig, tableCount: number): Position[] {
  return generateAutoFitLayout(
    Array.from({ length: tableCount }, () => ({
      capacity: config.seatsPerTable,
      shape: config.tableShape,
    })),
    config.aspectRatio,
    config.venueCapacity ?? 100,
    config.tableShape
  )
}

/**
 * Generate non-overlapping grid positions using each table's actual capacity and shape.
 *
 * Coordinate system: positions are 0–100% on both axes. When rendering in SVG:
 *   x_svg = x_pct * aspectRatio
 *   y_svg = y_pct
 */
export function generateAutoFitLayout(
  tables: Array<{ capacity: number; shape: string | null }>,
  aspectRatio: number,
  venueCapacity: number,
  defaultShape = "CIRCLE"
): Position[] {
  const n = tables.length
  if (n === 0) return []
  if (n === 1) return [{ x: 50, y: 50 }]

  const roomHeight = getRoomHeight(Math.max(venueCapacity, 10), aspectRatio)
  const svgW = aspectRatio * 100
  const svgH = 100

  // Compute per-table SVG half-dims
  const dims = tables.map((t) =>
    getTableSvgDims(t.capacity, t.shape ?? defaultShape, roomHeight)
  )

  // Cell size based on the largest table so no two cells ever overlap
  const maxRx = Math.max(...dims.map((d) => d.rx))
  const maxRy = Math.max(...dims.map((d) => d.ry))
  const gap = Math.max(maxRx, maxRy) * 0.6 // minimum aisle between tables
  const cellW = maxRx * 2 + gap
  const cellH = maxRy * 2 + gap

  // Find grid dimensions (rows × cols) whose aspect ratio best matches the room
  let bestRows = 1
  let bestCols = n
  let bestScore = Infinity
  for (let rows = 1; rows <= n; rows++) {
    const cols = Math.ceil(n / rows)
    const gridAspect = (cols * cellW) / (rows * cellH)
    const score = Math.abs(gridAspect - aspectRatio)
    if (score < bestScore) {
      bestScore = score
      bestRows = rows
      bestCols = cols
    }
  }

  // Center the grid within the SVG canvas
  const totalW = bestCols * cellW
  const totalH = bestRows * cellH
  const originX = (svgW - totalW) / 2 + cellW / 2
  const originY = (svgH - totalH) / 2 + cellH / 2

  return tables.map((_, i) => {
    const row = Math.floor(i / bestCols)
    const col = i % bestCols
    const xSvg = originX + col * cellW
    const ySvg = originY + row * cellH
    return {
      x: Math.min(95, Math.max(5, xSvg / aspectRatio)),
      y: Math.min(95, Math.max(5, ySvg)),
    }
  })
}

/**
 * Return the IDs of all tables that overlap with at least one other table.
 * Uses axis-aligned bounding box (AABB) collision with a small tolerance gap.
 */
export function detectOverlaps(
  tables: Array<{
    id: string
    x: number | null
    y: number | null
    capacity: number
    shape: string | null
  }>,
  aspectRatio: number,
  venueCapacity: number,
  defaultShape = "CIRCLE"
): Set<string> {
  const roomHeight = getRoomHeight(Math.max(venueCapacity, 10), aspectRatio)
  const tolerance = 1 // SVG units of acceptable overlap (rounding / drag imprecision)

  const overlapping = new Set<string>()

  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const a = tables[i]
      const b = tables[j]

      const ax = (a.x ?? 50) * aspectRatio
      const ay = a.y ?? 50
      const bx = (b.x ?? 50) * aspectRatio
      const by = b.y ?? 50

      const ad = getTableSvgDims(a.capacity, a.shape ?? defaultShape, roomHeight)
      const bd = getTableSvgDims(b.capacity, b.shape ?? defaultShape, roomHeight)

      const overlapX = Math.abs(ax - bx) < ad.rx + bd.rx - tolerance
      const overlapY = Math.abs(ay - by) < ad.ry + bd.ry - tolerance

      if (overlapX && overlapY) {
        overlapping.add(a.id)
        overlapping.add(b.id)
      }
    }
  }

  return overlapping
}
