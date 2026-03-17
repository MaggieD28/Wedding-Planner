export type GuestForAssign = {
  id: string
  name: string
  side: string // "Bride" | "Groom" — use .toUpperCase() for comparison
  is_head_table: boolean
  head_guest_id: string | null // non-null = this guest is a plus-one
  hasPlusOne: boolean          // true = this guest has a plus-one
}

export type SeatForAssign = {
  id: string
  guest_id: string | null
  guest_side?: string | null // side of currently-seated guest (for scoring)
}

export type TableForAssign = {
  id: string
  is_head_table: boolean
  seats: SeatForAssign[]
}

export type ConstraintForAssign = {
  guest_a_id: string
  guest_b_id: string
  type: string
}

type Cohort = {
  guests: GuestForAssign[]
  label: string
}

function scoreTable(
  table: TableForAssign,
  cohort: Cohort,
  constraints: ConstraintForAssign[],
  closedTableIds: Set<string>
): number {
  if (table.is_head_table) return -Infinity
  if (closedTableIds.has(table.id)) return -Infinity

  const emptySeats = table.seats.filter((s) => !s.guest_id).length
  if (emptySeats < cohort.guests.length) return -Infinity

  let score = 0
  const cohortIds = new Set(cohort.guests.map((g) => g.id))
  const cohortSides = new Set(cohort.guests.map((g) => g.side.toUpperCase()))

  for (const seat of table.seats) {
    if (!seat.guest_id) continue
    const occupantId = seat.guest_id
    const occupantSide = (seat.guest_side ?? "").toUpperCase()

    // +10 for matching side
    if (cohortSides.has(occupantSide)) {
      score += 10
    }

    // Constraint scoring between cohort guests and existing occupants
    for (const g of cohort.guests) {
      for (const c of constraints) {
        const involves =
          (c.guest_a_id === g.id && c.guest_b_id === occupantId) ||
          (c.guest_b_id === g.id && c.guest_a_id === occupantId)
        if (!involves) continue
        if (c.type === "PREFER") score += 20
        if (c.type === "AVOID") score -= 1000
      }
    }
  }

  // AVOID within same table for non-cohort seats
  for (const g of cohort.guests) {
    for (const seat of table.seats) {
      if (!seat.guest_id || cohortIds.has(seat.guest_id)) continue
      for (const c of constraints) {
        const involves =
          (c.guest_a_id === g.id && c.guest_b_id === seat.guest_id) ||
          (c.guest_b_id === g.id && c.guest_a_id === seat.guest_id)
        if (involves && c.type === "AVOID") score -= 1000
      }
    }
  }

  return score
}

function buildGroupCohorts(
  guests: GuestForAssign[],
  maxTableSize: number
): Cohort[] {
  // Skip plus-one guests and guests who have a plus-one (handle manually)
  const eligible = guests.filter((g) => !g.head_guest_id && !g.hasPlusOne)

  // Group by side
  const groups = new Map<string, GuestForAssign[]>()
  for (const guest of eligible) {
    const key = guest.side.toUpperCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(guest)
  }

  const cohorts: Cohort[] = []
  for (const [side, members] of groups) {
    if (members.length > maxTableSize) {
      for (let i = 0; i < members.length; i += maxTableSize) {
        const chunk = members.slice(i, i + maxTableSize)
        cohorts.push({ guests: chunk, label: side })
      }
    } else {
      cohorts.push({ guests: members, label: side })
    }
  }

  // Largest groups first
  cohorts.sort((a, b) => b.guests.length - a.guests.length)
  return cohorts
}

export function computeAutoAssign(
  unassigned: GuestForAssign[],
  allTables: TableForAssign[],
  constraints: ConstraintForAssign[],
  tableId?: string
): { assignments: { seatId: string; guestId: string }[]; skipped: string[] } {
  const assignments: { seatId: string; guestId: string }[] = []
  const skipped: string[] = []

  // Mutable copy of tables (track in-progress assignments)
  const mutableTables: TableForAssign[] = allTables.map((t) => ({
    ...t,
    seats: t.seats.map((s) => ({ ...s })),
  }))

  const maxTableSize = Math.max(...allTables.map((t) => t.seats.length), 1)

  function assignCohortToTable(cohort: Cohort, table: TableForAssign) {
    const emptySeats = table.seats.filter((s) => !s.guest_id)
    for (let i = 0; i < cohort.guests.length; i++) {
      if (i >= emptySeats.length) {
        skipped.push(cohort.guests[i].name)
        continue
      }
      const guest = cohort.guests[i]
      const seat = emptySeats[i]
      assignments.push({ seatId: seat.id, guestId: guest.id })
      seat.guest_id = guest.id
    }
  }

  // Per-table fill mode (Fill button)
  if (tableId) {
    const targetTable = mutableTables.find((t) => t.id === tableId)
    if (!targetTable) return { assignments, skipped }

    const candidates = unassigned.filter((g) => !g.is_head_table)
    const cohorts = buildGroupCohorts(candidates, maxTableSize)

    for (const cohort of cohorts) {
      const score = scoreTable(targetTable, cohort, constraints, new Set())
      if (score === -Infinity) continue
      assignCohortToTable(cohort, targetTable)
    }

    return { assignments, skipped }
  }

  // Phase 1: Assign head-table guests to the head table
  const headTable = mutableTables.find((t) => t.is_head_table)
  const headGuests = unassigned.filter((g) => g.is_head_table)

  if (headTable) {
    const emptyHeadSeats = headTable.seats.filter((s) => !s.guest_id)
    for (let i = 0; i < headGuests.length; i++) {
      if (i >= emptyHeadSeats.length) {
        skipped.push(headGuests[i].name)
        continue
      }
      const guest = headGuests[i]
      const seat = emptyHeadSeats[i]
      assignments.push({ seatId: seat.id, guestId: guest.id })
      seat.guest_id = guest.id
    }
  } else {
    for (const g of headGuests) skipped.push(g.name)
  }

  // Phase 2: Group-first for regular guests
  const regularGuests = unassigned.filter((g) => !g.is_head_table)
  const cohorts = buildGroupCohorts(regularGuests, maxTableSize)
  const closedTableIds = new Set<string>()

  for (const cohort of cohorts) {
    let bestTable: TableForAssign | null = null
    let bestScore = -Infinity

    for (const table of mutableTables) {
      const score = scoreTable(table, cohort, constraints, closedTableIds)
      if (score > bestScore) {
        bestScore = score
        bestTable = table
      }
    }

    if (!bestTable || bestScore === -Infinity) {
      for (const g of cohort.guests) skipped.push(g.name)
      continue
    }

    assignCohortToTable(cohort, bestTable)
    closedTableIds.add(bestTable.id)
  }

  return { assignments, skipped }
}
