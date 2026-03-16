"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, X, Lock, Unlock } from "lucide-react"
import type { Decision } from "@/types/database"

interface Props {
  initialDecisions: Decision[]
}

const EMPTY: Partial<Decision> = {
  date: new Date().toISOString().split("T")[0],
  what_was_decided: "", options_considered: "", rationale: "",
  owner: "Both", locked: false, notes: "",
}

export default function DecisionsClient({ initialDecisions }: Props) {
  const supabase = createClient()
  const [decisions, setDecisions] = useState<Decision[]>(initialDecisions)
  const [showModal, setShowModal] = useState(false)
  const [editDecision, setEditDecision] = useState<Decision | null>(null)
  const [formData, setFormData] = useState<Partial<Decision>>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const ch = supabase.channel("decisions-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "decisions" }, p => {
        if (p.eventType === "INSERT") setDecisions(prev => [...prev, p.new as Decision])
        else if (p.eventType === "UPDATE") setDecisions(prev => prev.map(d => d.id === (p.new as Decision).id ? p.new as Decision : d))
        else if (p.eventType === "DELETE") setDecisions(prev => prev.filter(d => d.id !== (p.old as Decision).id))
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase])

  function openAdd() { setEditDecision(null); setFormData({ ...EMPTY, date: new Date().toISOString().split("T")[0] }); setShowModal(true) }
  function openEdit(d: Decision) { setEditDecision(d); setFormData({ ...d }); setShowModal(true) }

  async function handleSave() {
    if (!formData.what_was_decided) return
    setSaving(true)
    if (editDecision) {
      const { data } = await supabase.from("decisions").update(formData).eq("id", editDecision.id).select().single()
      if (data) setDecisions(p => p.map(d => d.id === editDecision.id ? data as Decision : d))
    } else {
      const maxId = decisions.reduce((max, d) => Math.max(max, parseInt(d.decision_id.replace("D", ""), 10) || 0), 0)
      const { data } = await supabase.from("decisions").insert({ ...formData, decision_id: `D${String(maxId + 1).padStart(3, "0")}` }).select().single()
      if (data) setDecisions(p => [...p, data as Decision])
    }
    setSaving(false); setShowModal(false)
  }

  async function toggleLock(d: Decision) {
    const { data } = await supabase.from("decisions").update({ locked: !d.locked }).eq("id", d.id).select().single()
    if (data) setDecisions(p => p.map(x => x.id === d.id ? data as Decision : x))
  }

  async function handleDelete(d: Decision) {
    if (d.locked) return alert("This decision is locked — unlock it first to delete.")
    if (!confirm("Delete this decision?")) return
    await supabase.from("decisions").delete().eq("id", d.id)
    setDecisions(p => p.filter(x => x.id !== d.id))
  }

  const field = (key: keyof Decision) => (v: string) => setFormData(p => ({ ...p, [key]: v || null }))

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-5xl font-light mb-1" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>
            Decisions Log
          </h1>
          <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
            A record of key decisions — so you don&apos;t re-litigate them.
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--color-sage)", color: "var(--color-charcoal)" }}>
          <Plus size={15} /> Add decision
        </button>
      </div>

      {decisions.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ backgroundColor: "var(--color-blush)" }}>
          <p className="text-lg mb-1" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>No decisions yet</p>
          <p className="text-sm" style={{ color: "var(--color-subtle)" }}>Add your first decision above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...decisions].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).map(d => (
            <div key={d.id} className="rounded-2xl p-5 cursor-pointer transition-opacity" onClick={() => openEdit(d)}
              style={{ backgroundColor: "var(--color-blush)", opacity: d.locked ? 0.85 : 1 }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {d.locked && <Lock size={13} style={{ color: "var(--color-subtle)" }} />}
                    <span className="text-xs" style={{ color: "var(--color-subtle)" }}>{d.decision_id} · {d.date ?? "No date"} · {d.owner ?? "—"}</span>
                  </div>
                  <p className="font-medium mb-2" style={{ color: "var(--color-charcoal)" }}>{d.what_was_decided}</p>
                  {d.rationale && (
                    <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
                      <span className="font-medium">Why: </span>{d.rationale}
                    </p>
                  )}
                  {d.options_considered && (
                    <p className="text-sm mt-1" style={{ color: "var(--color-subtle)" }}>
                      <span className="font-medium">Options: </span>{d.options_considered}
                    </p>
                  )}
                  {d.notes && (
                    <p className="text-sm mt-1" style={{ color: "var(--color-subtle)" }}>{d.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={e => { e.stopPropagation(); toggleLock(d) }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: d.locked ? "var(--color-warm-red)" : "var(--color-sage-light)" }}>
                    {d.locked ? <Lock size={15} /> : <Unlock size={15} />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(d) }}
                    className="p-1.5 rounded-lg" style={{ color: "var(--color-sage-light)" }}>
                    <X size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(74,87,89,0.4)" }}>
          <div className="rounded-2xl p-6 w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "white" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-medium" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>
                {editDecision ? "Edit Decision" : "Add Decision"}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={20} style={{ color: "var(--color-subtle)" }} /></button>
            </div>
            <div className="space-y-4">
              <DField label="Date" value={formData.date ?? ""} onChange={field("date")} type="date" />
              <DTextarea label="What was decided *" value={formData.what_was_decided ?? ""} onChange={v => setFormData(p => ({ ...p, what_was_decided: v }))} rows={2} />
              <DTextarea label="Options considered" value={formData.options_considered ?? ""} onChange={field("options_considered")} rows={2} />
              <DTextarea label="Rationale / why" value={formData.rationale ?? ""} onChange={field("rationale")} rows={2} />
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-subtle)" }}>Owner</label>
                <select value={formData.owner ?? "Both"} onChange={e => setFormData(p => ({ ...p, owner: e.target.value as Decision["owner"] }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={{ borderColor: "var(--color-sage-light)", color: "var(--color-charcoal)" }}>
                  {["Maggie", "Bobby", "Both"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <DTextarea label="Notes" value={formData.notes ?? ""} onChange={field("notes")} rows={2} />
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--color-charcoal)" }}>
                <input type="checkbox" checked={formData.locked ?? false} onChange={e => setFormData(p => ({ ...p, locked: e.target.checked }))} />
                Lock this decision (mark as final)
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-sm" style={{ color: "var(--color-subtle)" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60" style={{ backgroundColor: "var(--color-sage)", color: "var(--color-charcoal)" }}>
                {saving ? "Saving…" : editDecision ? "Save changes" : "Add decision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DField({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-subtle)" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--color-sage-light)", color: "var(--color-charcoal)" }} />
    </div>
  )
}

function DTextarea({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-subtle)" }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={{ borderColor: "var(--color-sage-light)", color: "var(--color-charcoal)" }} />
    </div>
  )
}
