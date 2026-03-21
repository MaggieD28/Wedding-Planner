"use client"

import { useState } from "react"
import type { DisplayTable } from "./TableCard"

type Suggestion = {
  id: string
  current: string
  suggested: string
}

type Props = {
  tables: DisplayTable[]
  onApply: (updates: { id: string; name: string }[]) => Promise<void>
  onClose: () => void
}

export default function NameTablesModal({ tables, onApply, onClose }: Props) {
  const [theme, setTheme] = useState("")
  const [excludeIds, setExcludeIds] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [edited, setEdited] = useState<Record<string, string>>({})

  function toggleExclude(id: string) {
    setExcludeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function generate() {
    if (!theme.trim()) return
    setLoading(true)
    setError(null)
    setEdited({})
    try {
      const res = await fetch("/api/seating/name-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: theme.trim(),
          tables: tables.map((t) => ({ id: t.id, name: t.name })),
          excludeIds: [...excludeIds],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setSuggestions(data.suggestions)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApply() {
    const updates = suggestions
      .filter((s) => !excludeIds.has(s.id))
      .map((s) => ({ id: s.id, name: edited[s.id] ?? s.suggested }))
    setApplying(true)
    await onApply(updates)
    setApplying(false)
    onClose()
  }

  const applyCount = suggestions.filter((s) => !excludeIds.has(s.id)).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--color-stone)" }}>
          <h2 className="font-semibold text-base" style={{ color: "var(--color-charcoal)", fontFamily: "var(--font-heading), Georgia, serif" }}>
            ✦ Name tables by theme
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Theme input */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-charcoal)" }}>
              Theme
            </label>
            <div className="flex gap-2">
              <input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") generate() }}
                placeholder="e.g. Greek islands, Jazz musicians, English gardens…"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: "var(--color-stone)" }}
              />
              <button
                onClick={generate}
                disabled={loading || !theme.trim()}
                className="px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 transition-opacity"
                style={{ background: "var(--color-charcoal)" }}
              >
                {loading ? "…" : suggestions.length > 0 ? "Regenerate" : "Generate"}
              </button>
            </div>
          </div>

          {/* Exclude tables */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--color-charcoal)" }}>
              Skip tables
            </p>
            <div className="flex flex-wrap gap-2">
              {tables.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={excludeIds.has(t.id)}
                    onChange={() => toggleExclude(t.id)}
                    className="rounded"
                  />
                  <span style={{ color: "var(--color-charcoal)" }}>{t.name}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--color-charcoal)" }}>
                Preview — click to edit suggested names
              </p>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--color-stone)" }}>
                <div className="grid grid-cols-2 text-[10px] font-semibold uppercase tracking-wide px-3 py-1.5 bg-stone-50" style={{ color: "var(--color-subtle)" }}>
                  <span>Current</span>
                  <span>Suggested</span>
                </div>
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    className={`grid grid-cols-2 px-3 py-2 border-t text-sm items-center ${excludeIds.has(s.id) ? "opacity-40" : ""}`}
                    style={{ borderColor: "var(--color-stone)" }}
                  >
                    <span className="truncate pr-2" style={{ color: "var(--color-subtle)" }}>{s.current}</span>
                    <input
                      value={edited[s.id] ?? s.suggested}
                      onChange={(e) => setEdited((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      disabled={excludeIds.has(s.id)}
                      className="border-b bg-transparent focus:outline-none text-sm w-full"
                      style={{ borderColor: "var(--color-stone)", color: "var(--color-charcoal)" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: "var(--color-stone)" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-stone-50"
            style={{ borderColor: "var(--color-stone)", color: "var(--color-subtle)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applying || suggestions.length === 0 || applyCount === 0}
            className="px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 transition-opacity"
            style={{ background: "var(--color-charcoal)" }}
          >
            {applying ? "Applying…" : `Apply ${applyCount} name${applyCount !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  )
}
