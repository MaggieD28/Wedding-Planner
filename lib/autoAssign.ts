export type GuestForAssign = {
  id: string
  name: string
  side: string // "Bride" | "Groom" — use .toUpperCase() for comparison
  last_name?: string | null
  group_id?: string | null
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
  x?: number | null
  y?: number | null
  seats: SeatForAssign[]
}

export type ConstraintForAssign = {
  guest_a_id: string
  guest_b_id: string
  type: string
}

export type GroupRuleForAssign = {
  type: "KEEP_TOGETHER" | "SEPARATE_FROM" | "NEAR_TABLE"
  group_id: string
  target_group_id: string | null
  target_table_id: string | null
}

type Cohort = {
  guests: GuestForAssign[]
  label: string
  group_id?: string | null
}

function tableDistance(a: TableForAssign, b: TableForAssign): number {
  if (a.x == null || a.y == null || b.x == null || b.y == null) return Infinity
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function scoreTable(
  table: TableForAssign,
  cohort: Cohort,
  constraints: ConstraintForAssign[],
  closedTableIds: Set<string>,
  groupRules: GroupRuleForAssign[],
  allTables: TableForAssign[],
  tableGroupMap: Map<string, string>
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

  // Group rules scoring
  if (cohort.group_id) {
    for (const rule of groupRules) {
      if (rule.group_id !== cohort.group_id) continue

      if (rule.type === "SEPARATE_FROM" && rule.target_group_id) {
        const existingGroupOnTable = tableGroupMap.get(table.id)
        if (existingGroupOnTable === rule.target_group_id) {
          score -= 100000
        }
      }

      if (rule.type === "NEAR_TABLE" && rule.target_table_id) {
        const targetTable = allTables.find((t) => t.id === rule.target_table_id)
        if (targetTable) {
          const dist = tableDistance(table, targetTable)
          if (dist < 20) score += 50
        }
      }
    }
  }

  return score
}

function buildGroupCohorts(
  guests: GuestForAssign[],
  maxTableSize: number,
  groupRules: GroupRuleForAssign[]
): Cohort[] {
  // Step 1: Group by explicit group_id first
  const groupMap = new Map<string, GuestForAssign[]>()
  const ungrouped: GuestForAssign[] = []

  for (const guest of guests) {
    if (guest.group_id) {
      if (!groupMap.has(guest.group_id)) groupMap.set(guest.group_id, [])
      groupMap.get(guest.group_id)!.push(guest)
    } else {
      ungrouped.push(guest)
    }
  }

  const cohorts: Cohort[] = []

  // Named group cohorts
  for (const [group_id, members] of groupMap) {
    const rule = groupRules.find((r) => r.group_id === group_id && r.type === "KEEP_TOGETHER")
    if (rule) {
      // KEEP_TOGETHER: never split
      cohorts.push({ guests: members, label: `group:${group_id}`, group_id })
    } else {
      for (let i = 0; i < members.length; i += maxTableSize) {
        cohorts.push({ guests: members.slice(i, i + maxTableSize), label: `group:${group_id}`, group_id })
      }
    }
  }

  // Step 2: Family name heuristic for ungrouped guests
  const familyMap = new Map<string, GuestForAssign[]>()
  const noFamily: GuestForAssign[] = []

  for (const guest of ungrouped) {
    const ln = (guest.last_name ?? "").trim().toLowerCase()
    if (ln) {
      if (!familyMap.has(ln)) familyMap.set(ln, [])
      familyMap.get(ln)!.push(guest)
    } else {
      noFamily.push(guest)
    }
  }

  for (const [lastName, members] of familyMap) {
    if (members.length === 1) {
      noFamily.push(members[0])
    } else {
      // Soft-group by family
      for (let i = 0; i < members.length; i += maxTableSize) {
        cohorts.push({ guests: members.slice(i, i + maxTableSize), label: `family:${lastName}` })
      }
    }
  }

  // Step 3: Remaining ungrouped — side-based grouping
  const sideGroups = new Map<string, GuestForAssign[]>()
  for (const guest of noFamily) {
    const key = guest.side.toUpperCase()
    if (!sideGroups.has(key)) sideGroups.set(key, [])
    sideGroups.get(key)!.push(guest)
  }

  for (const [side, members] of sideGroups) {
    for (let i = 0; i < members.length; i += maxTableSize) {
      cohorts.push({ guests: members.slice(i, i + maxTableSize), label: side })
    }
  }

  cohorts.sort((a, b) => b.guests.length - a.guests.length)
  return cohorts
}

export function computeAutoAssign(
  unassigned: GuestForAssign[],
  allTables: TableForAssign[],
  constraints: ConstraintForAssign[],
  tableId?: string,
  groupRules: GroupRuleForAssign[] = []
): { assignments: { seatId: string; guestId: string }[]; skipped: string[] } {
  const assignments: { seatId: string; guestId: string }[] = []
  const skipped: string[] = []

  // Mutable copy of tables
  const mutableTables: TableForAssign[] = allTables.map((t) => ({
    ...t,
    seats: t.seats.map((s) => ({ ...s })),
  }))

  const maxTableSize = Math.max(...allTables.map((t) => t.seats.length), 1)

  // Build tableGroupMap: tableId -> dominant group_id for SEPARATE_FROM scoring
  const tableGroupMap = new Map<string, string>()
  for (const table of mutableTables) {
    const groupCounts = new Map<string, number>()
    for (const seat of table.seats) {
      if (!seat.guest_id) continue
      const guest = unassigned.find((g) => g.id === seat.guest_id)
      if (guest?.group_id) {
        groupCounts.set(guest.group_id, (groupCounts.get(guest.group_id) ?? 0) + 1)
      }
    }
    if (groupCounts.size > 0) {
      const dominant = [...groupCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      tableGroupMap.set(table.id, dominant)
    }
  }

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
      if (guest.group_id) tableGroupMap.set(table.id, guest.group_id)
    }
  }

  // Per-table fill mode (Fill button)
  if (tableId) {
    const targetTable = mutableTables.find((t) => t.id === tableId)
    if (!targetTable) return { assignments, skipped }

    const candidates = unassigned.filter((g) => !g.is_head_table)
    const cohorts = buildGroupCohorts(candidates, maxTableSize, groupRules)

    for (const cohort of cohorts) {
      const score = scoreTable(targetTable, cohort, constraints, new Set(), groupRules, mutableTables, tableGroupMap)
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

  // Phase 2: Handle plus-one pairs — force same cohort (MUST same table)
  const regularGuests = unassigned.filter((g) => !g.is_head_table)
  const plusOnePairs = new Map<string, GuestForAssign>() // head_guest_id -> plus-one guest

  for (const g of regularGuests) {
    if (g.head_guest_id) {
      plusOnePairs.set(g.head_guest_id, g)
    }
  }

  const pairedIds = new Set<string>()
  const pairedCohorts: Cohort[] = []

  for (const [headId, plusOne] of plusOnePairs) {
    const headGuest = regularGuests.find((g) => g.id === headId)
    if (headGuest) {
      pairedCohorts.push({
        guests: [headGuest, plusOne],
        label: headGuest.group_id ? `group:${headGuest.group_id}` : headGuest.side.toUpperCase(),
        group_id: headGuest.group_id ?? plusOne.group_id,
      })
      pairedIds.add(headId)
      pairedIds.add(plusOne.id)
    }
  }

  // Remaining guests (not in a pair)
  const unpaired = regularGuests.filter((g) => !pairedIds.has(g.id))
  const groupCohorts = buildGroupCohorts(unpaired, maxTableSize, groupRules)
  const allCohorts = [...pairedCohorts, ...groupCohorts]
  allCohorts.sort((a, b) => b.guests.length - a.guests.length)

  const closedTableIds = new Set<string>()

  for (const cohort of allCohorts) {
    let bestTable: TableForAssign | null = null
    let bestScore = -Infinity

    for (const table of mutableTables) {
      const score = scoreTable(table, cohort, constraints, closedTableIds, groupRules, mutableTables, tableGroupMap)
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
