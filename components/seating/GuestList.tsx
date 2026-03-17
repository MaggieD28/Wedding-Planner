"use client"

import GuestCard, { type SeatingGuest } from "./GuestCard"

type Props = {
  guests: SeatingGuest[]
  filter: string
  onFilterChange: (v: string) => void
}

export default function GuestList({ guests, filter, onFilterChange }: Props) {
  const filtered = guests.filter(
    (g) =>
      g.name.toLowerCase().includes(filter.toLowerCase()) ||
      g.group.toLowerCase().includes(filter.toLowerCase()) ||
      g.side.toLowerCase().includes(filter.toLowerCase())
  )

  const grouped: Record<string, SeatingGuest[]> = {}
  for (const g of filtered) {
    if (!grouped[g.group]) grouped[g.group] = []
    grouped[g.group].push(g)
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Filter guests…"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2"
        style={{ borderColor: "var(--color-stone)" }}
      />
      <div className="space-y-3">
        {Object.entries(grouped).map(([group, groupGuests]) => (
          <div key={group}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1 px-1" style={{ color: "var(--color-subtle)" }}>
              {group}
            </p>
            <div className="space-y-1">
              {groupGuests.map((g) => (
                <GuestCard key={g.id} guest={g} />
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-center pt-4" style={{ color: "var(--color-subtle)" }}>
            No unassigned guests
          </p>
        )}
      </div>
    </div>
  )
}
