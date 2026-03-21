export type TableWithGuests = {
  id: string
  x?: number | null
  y?: number | null
  seats: { id: string; guest_id: string | null; group_id?: string | null }[]
}

export type ConstraintInput = {
  id: string
  guest_a_id: string
  guest_b_id: string
  type: "AVOID" | "PREFER"
}

export type GroupRuleInput = {
  id: string
  type: "KEEP_TOGETHER" | "SEPARATE_FROM" | "NEAR_TABLE"
  group_id: string
  target_group_id: string | null
  target_table_id: string | null
}

export type ConflictResult = {
  avoidViolations: Set<string>   // seatIds with AVOID violations (hard, red)
  preferWarnings: Set<string>    // seatIds with PREFER warnings (soft, amber)
  groupViolations: Set<string>   // seatIds with group-rule hard violations (red)
  groupWarnings: Set<string>     // seatIds with group-rule soft warnings (amber)
}

export function computeConflicts(
  tables: TableWithGuests[],
  constraints: ConstraintInput[],
  groupRules: GroupRuleInput[] = [],
  guestGroupMap: Map<string, string> = new Map() // guestId -> group_id
): ConflictResult {
  const avoidViolations = new Set<string>()
  const preferWarnings = new Set<string>()
  const groupViolations = new Set<string>()
  const groupWarnings = new Set<string>()

  // Build map: guestId -> { tableId, seatId }
  const guestLocation = new Map<string, { tableId: string; seatId: string }>()
  for (const table of tables) {
    for (const seat of table.seats) {
      if (seat.guest_id) {
        guestLocation.set(seat.guest_id, { tableId: table.id, seatId: seat.id })
      }
    }
  }

  // Individual AVOID / PREFER constraints
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

  // Group rule violations
  // Build: tableId -> Set<group_id> present
  const tableGroups = new Map<string, Set<string>>()
  for (const table of tables) {
    const groupsOnTable = new Set<string>()
    for (const seat of table.seats) {
      if (!seat.guest_id) continue
      const gid = guestGroupMap.get(seat.guest_id)
      if (gid) groupsOnTable.add(gid)
    }
    tableGroups.set(table.id, groupsOnTable)
  }

  // Build: group_id -> Set<tableId> where group has members
  const groupTables = new Map<string, Set<string>>()
  for (const [guestId, groupId] of guestGroupMap) {
    const loc = guestLocation.get(guestId)
    if (!loc) continue
    if (!groupTables.has(groupId)) groupTables.set(groupId, new Set())
    groupTables.get(groupId)!.add(loc.tableId)
  }

  for (const rule of groupRules) {
    const tablesForGroup = groupTables.get(rule.group_id)
    if (!tablesForGroup || tablesForGroup.size === 0) continue

    if (rule.type === "KEEP_TOGETHER" && tablesForGroup.size > 1) {
      // Group is split — soft warning (amber)
      for (const tableId of tablesForGroup) {
        const table = tables.find((t) => t.id === tableId)
        if (!table) continue
        for (const seat of table.seats) {
          if (!seat.guest_id) continue
          const gid = guestGroupMap.get(seat.guest_id)
          if (gid === rule.group_id) groupWarnings.add(seat.id)
        }
      }
    }

    if (rule.type === "SEPARATE_FROM" && rule.target_group_id) {
      // Check if both groups share any table
      const tablesForTarget = groupTables.get(rule.target_group_id)
      if (!tablesForTarget) continue
      for (const tableId of tablesForGroup) {
        if (!tablesForTarget.has(tableId)) continue
        // Hard violation — both groups on same table
        const table = tables.find((t) => t.id === tableId)
        if (!table) continue
        for (const seat of table.seats) {
          if (!seat.guest_id) continue
          const gid = guestGroupMap.get(seat.guest_id)
          if (gid === rule.group_id || gid === rule.target_group_id) {
            groupViolations.add(seat.id)
          }
        }
      }
    }

    if (rule.type === "NEAR_TABLE" && rule.target_table_id) {
      const targetTable = tables.find((t) => t.id === rule.target_table_id)
      if (!targetTable || targetTable.x == null || targetTable.y == null) continue

      for (const tableId of tablesForGroup) {
        const table = tables.find((t) => t.id === tableId)
        if (!table || table.x == null || table.y == null) continue
        const dist = Math.sqrt((table.x - targetTable.x) ** 2 + (table.y - targetTable.y) ** 2)
        if (dist > 20) {
          // Not near — soft warning
          for (const seat of table.seats) {
            if (!seat.guest_id) continue
            const gid = guestGroupMap.get(seat.guest_id)
            if (gid === rule.group_id) groupWarnings.add(seat.id)
          }
        }
      }
    }
  }

  return { avoidViolations, preferWarnings, groupViolations, groupWarnings }
}
