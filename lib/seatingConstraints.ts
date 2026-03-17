export type TableWithGuests = {
  id: string
  seats: { id: string; guest_id: string | null }[]
}

export type ConstraintInput = {
  id: string
  guest_a_id: string
  guest_b_id: string
  type: "AVOID" | "PREFER"
}

export type ConflictResult = {
  avoidViolations: Set<string> // seatIds with AVOID violations
  preferWarnings: Set<string>  // seatIds with PREFER warnings (not at same table)
}

export function computeConflicts(
  tables: TableWithGuests[],
  constraints: ConstraintInput[]
): ConflictResult {
  const avoidViolations = new Set<string>()
  const preferWarnings = new Set<string>()

  // Build map: guestId -> { tableId, seatId }
  const guestLocation = new Map<string, { tableId: string; seatId: string }>()
  for (const table of tables) {
    for (const seat of table.seats) {
      if (seat.guest_id) {
        guestLocation.set(seat.guest_id, { tableId: table.id, seatId: seat.id })
      }
    }
  }

  for (const constraint of constraints) {
    const locA = guestLocation.get(constraint.guest_a_id)
    const locB = guestLocation.get(constraint.guest_b_id)

    if (!locA || !locB) continue

    if (constraint.type === "AVOID") {
      if (locA.tableId === locB.tableId) {
        avoidViolations.add(locA.seatId)
        avoidViolations.add(locB.seatId)
      }
    } else if (constraint.type === "PREFER") {
      if (locA.tableId !== locB.tableId) {
        preferWarnings.add(locA.seatId)
        preferWarnings.add(locB.seatId)
      }
    }
  }

  return { avoidViolations, preferWarnings }
}
