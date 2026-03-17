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
 *
 * Positions are stored as 0–100% for both x and y axes. When rendering:
 *   x_svg = x_pct * aspectRatio   (viewBox width = aspectRatio * 100)
 *   y_svg = y_pct                  (viewBox height = 100)
 */
export function generateLayout(config: RoomLayoutConfig, tableCount: number): Position[] {
  if (tableCount <= 0) return []
  if (tableCount === 1) return [{ x: 50, y: 50 }]

  const ratio = config.aspectRatio
  const venueCapacity = config.venueCapacity ?? 100

  const roomHeight = getRoomHeight(venueCapacity, ratio)

  const { rx: tableRx, ry: tableRy } = getTableSvgDims(
    config.seatsPerTable,
    config.tableShape,
    roomHeight
  )
  const tableW = tableRx * 2
  const tableH = tableRy * 2

  const svgW = ratio * 100
  const svgH = 100

  let bestRows = 1
  let bestCols = tableCount
  let bestScore = Infinity

  for (let rows = 1; rows <= tableCount; rows++) {
    const cols = Math.ceil(tableCount / rows)
    const score = Math.abs(cols / rows - svgW / svgH)
    if (score < bestScore) {
      bestScore = score
      bestRows = rows
      bestCols = cols
    }
  }

  const edgePadX = Math.max(5, tableW * 0.7)
  const edgePadY = Math.max(5, tableH * 0.7)

  const usableW = svgW - 2 * edgePadX
  const usableH = svgH - 2 * edgePadY

  const minSpacingX = tableW * 1.2
  const minSpacingY = tableH * 1.2

  const spacingX =
    bestCols === 1 ? 0 : Math.max(minSpacingX, usableW / (bestCols - 1))
  const spacingY =
    bestRows === 1 ? 0 : Math.max(minSpacingY, usableH / (bestRows - 1))

  const positions: Position[] = []
  for (let i = 0; i < tableCount; i++) {
    const row = Math.floor(i / bestCols)
    const col = i % bestCols

    const xSvg = bestCols === 1 ? svgW / 2 : edgePadX + col * spacingX
    const ySvg = bestRows === 1 ? svgH / 2 : edgePadY + row * spacingY

    positions.push({
      x: Math.min(95, Math.max(5, xSvg / ratio)),
      y: Math.min(95, Math.max(5, ySvg)),
    })
  }

  return positions
}
