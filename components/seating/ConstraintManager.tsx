"use client"

import { useState } from "react"
import type { SeatingGuest } from "./GuestCard"

export type DisplayConstraint = {
  id: string
  guest_a_id: string
  guest_b_id: string
  type: "AVOID" | "PREFER"
  guest_a: SeatingGuest
  guest_b: SeatingGuest
}

type Props = {
  guests: SeatingGuest[]
  constraints: DisplayConstraint[]
  onAdd: (guestAId: string, guestBId: string, type: "AVOID" | "PREFER") => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

export default function ConstraintManager({
  guests,
  constraints,
  onAdd,
  onDelete,
  onClose,
}: Props) {
  const [guestAId, setGuestAId] = useState("")
  const [guestBId, setGuestBId] = useState("")
  const [type, setType] = useState<"AVOID" | "PREFER">("AVOID")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestAId || !guestBId || guestAId === guestBId) {
      setError("Select two different guests.")
      return
    }
    setSaving(true)
    setError("")
    try {
      await onAdd(guestAId, guestBId, type)
      setGuestAId("")
      setGuestBId("")
    } catch {
      setError("Constraint already exists.")
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: "var(--color-charcoal)", fontFamily: "var(--font-heading), Georgia, serif" }}>
            Seating Constraints
          </h2>
          <button onClick={onClose} className="text-xl" style={{ color: "var(--color-subtle)" }}>&times;</button>
        </div>

        <form onSubmit={handleAdd} className="space-y-3 mb-4">
          <div className="flex gap-2">
            <select
              value={guestAId}
              onChange={(e) => setGuestAId(e.target.value)}
              className="flex-1 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--color-stone)" }}
            >
              <option value="">Guest A…</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "AVOID" | "PREFER")}
              className="border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--color-stone)" }}
            >
              <option value="AVOID">AVOID</option>
              <option value="PREFER">PREFER</option>
            </select>
            <select
              value={guestBId}
              onChange={(e) => setGuestBId(e.target.value)}
              className="flex-1 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--color-stone)" }}
            >
              <option value="">Guest B…</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full text-white rounded-lg py-2 text-sm disabled:opacity-50"
            style={{ background: "var(--color-charcoal)" }}
          >
            {saving ? "Adding…" : "Add Constraint"}
          </button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-2">
          {constraints.length === 0 && (
            <p className="text-sm text-center pt-4" style={{ color: "var(--color-subtle)" }}>
              No constraints yet
            </p>
          )}
          {constraints.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 rounded-lg border text-sm"
              style={
                c.type === "AVOID"
                  ? { background: "#fdf2f2", borderColor: "#f5c6c6" }
                  : { background: "#fdf8ec", borderColor: "#f0d9a0" }
              }
            >
              <span>
                <strong>{c.guest_a.name}</strong>
                <span
                  className="mx-2 font-medium"
                  style={{ color: c.type === "AVOID" ? "var(--color-warm-red)" : "#a07820" }}
                >
                  {c.type}
                </span>
                <strong>{c.guest_b.name}</strong>
              </span>
              <button
                onClick={() => onDelete(c.id)}
                className="ml-2"
                style={{ color: "var(--color-subtle)" }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
