"use client"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, X } from "lucide-react"
import type { BudgetItem, Vendor } from "@/types/database"

interface Props {
  initialItems: BudgetItem[]
  vendors: Vendor[]
  fxRate: number
}

const EMPTY_ITEM: Partial<BudgetItem> = {
  category: "", description: "", units: 1, price_per_unit_eur: 0,
  actual_invoiced_eur: 0, actual_paid_eur: 0, active: true,
}

export default function BudgetClient({ initialItems, vendors, fxRate }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState<BudgetItem[]>(initialItems)
  const [currency, setCurrency] = useState<"EUR" | "GBP">("EUR")
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<BudgetItem | null>(null)
  const [formData, setFormData] = useState<Partial<BudgetItem>>(EMPTY_ITEM)
  const [saving, setSaving] = useState(false)

  const conv = (eur: number) => currency === "GBP" ? eur * fxRate : eur
  const sym  = currency === "GBP" ? "£" : "€"
  const fmt  = (n: number) => `${sym}${conv(n).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`

  const active = items.filter(i => i.active)
  const totals = useMemo(() => ({
    budget:    active.reduce((s, i) => s + i.price_per_unit_eur * i.units, 0),
    invoiced:  active.reduce((s, i) => s + i.actual_invoiced_eur, 0),
    paid:      active.reduce((s, i) => s + i.actual_paid_eur, 0),
  }), [active])

  useEffect(() => {
    const ch = supabase.channel("budget-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_items" }, p => {
        if (p.eventType === "INSERT") setItems(prev => [...prev, p.new as BudgetItem])
        else if (p.eventType === "UPDATE") setItems(prev => prev.map(i => i.id === (p.new as BudgetItem).id ? p.new as BudgetItem : i))
        else if (p.eventType === "DELETE") setItems(prev => prev.filter(i => i.id !== (p.old as BudgetItem).id))
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase])

  function openAdd() { setEditItem(null); setFormData(EMPTY_ITEM); setShowModal(true) }
  function openEdit(i: BudgetItem) { setEditItem(i); setFormData({ ...i }); setShowModal(true) }

  async function handleSave() {
    setSaving(true)
    if (editItem) {
      const { data } = await supabase.from("budget_items").update(formData).eq("id", editItem.id).select().single()
      if (data) setItems(p => p.map(i => i.id === editItem.id ? data as BudgetItem : i))
    } else {
      const maxId = items.reduce((max, i) => {
        const n = parseInt(i.budget_item_id.replace(/[^\d]/g, ""), 10)
        return isNaN(n) ? max : Math.max(max, n)
      }, 0)
      const budget_item_id = `B${String(maxId + 1).padStart(3, "0")}`
      const { data } = await supabase.from("budget_items").insert({ ...formData, budget_item_id }).select().single()
      if (data) setItems(p => [...p, data as BudgetItem])
    }
    setSaving(false)
    setShowModal(false)
  }

  async function toggleActive(item: BudgetItem) {
    const { data } = await supabase.from("budget_items").update({ active: !item.active }).eq("id", item.id).select().single()
    if (data) setItems(p => p.map(i => i.id === item.id ? data as BudgetItem : i))
  }

  const grouped = useMemo(() => {
    return items.reduce((acc, item) => {
      const cat = item.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(item)
      return acc
    }, {} as Record<string, BudgetItem[]>)
  }, [items])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-5xl font-light mb-1" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>Budget</h1>
          <p className="text-sm" style={{ color: "var(--color-subtle)" }}>{active.length} active line items</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Currency toggle */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--color-sage-light)" }}>
            {(["EUR", "GBP"] as const).map(c => (
              <button key={c} onClick={() => setCurrency(c)} className="px-4 py-2 text-sm font-medium transition-colors"
                style={{ backgroundColor: currency === c ? "var(--color-sage)" : "transparent", color: currency === c ? "var(--color-charcoal)" : "var(--color-subtle)" }}>
                {c === "EUR" ? "€ EUR" : "£ GBP"}
              </button>
            ))}
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--color-sage)", color: "var(--color-charcoal)" }}>
            <Plus size={15} /> Add line
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total budget", value: totals.budget, color: "var(--color-charcoal)" },
          { label: "Total paid",   value: totals.paid,   color: "var(--color-sage)" },
          { label: "Remaining",    value: totals.budget - totals.paid, color: "var(--color-warm-red)" },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-5" style={{ backgroundColor: "var(--color-blush)" }}>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--color-subtle)" }}>{card.label}</p>
            <p className="text-3xl font-light" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: card.color }}>
              {fmt(card.value)}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-subtle)" }}>
              Bobby: {fmt(card.value / 2)} · Maggie: {fmt(card.value / 2)}
            </p>
          </div>
        ))}
      </div>

      {/* Line items by category */}
      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category} className="mb-6">
          <h2 className="text-lg font-medium mb-2 px-1" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>
            {category}
          </h2>
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--color-blush)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-sage-light)" }}>
                  {["Description", "Vendor", "Units", "Per unit", "Budget", "Invoiced", "Paid", "Variance", "Active"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>{h}</th>
                  ))}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {catItems.map((item, idx) => {
                  const budget   = item.price_per_unit_eur * item.units
                  const variance = budget - item.actual_paid_eur
                  const vendor   = vendors.find(v => v.vendor_id === item.vendor_id)
                  return (
                    <tr key={item.id} onClick={() => openEdit(item)} className="cursor-pointer transition-opacity"
                      style={{ borderBottom: idx < catItems.length - 1 ? "1px solid var(--color-sage-light)" : "none", opacity: item.active ? 1 : 0.4 }}>
                      <td className="px-4 py-3" style={{ color: "var(--color-charcoal)" }}>{item.description}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{vendor?.vendor_name ?? "–"}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{item.units}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{fmt(item.price_per_unit_eur)}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--color-charcoal)" }}>{fmt(budget)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{fmt(item.actual_invoiced_eur)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--color-sage)" }}>{fmt(item.actual_paid_eur)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: variance >= 0 ? "var(--color-charcoal)" : "var(--color-warm-red)" }}>{fmt(variance)}</td>
                      <td className="px-4 py-3">
                        <button onClick={e => { e.stopPropagation(); toggleActive(item) }}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: item.active ? "var(--color-sage)" : "var(--color-sage-light)", color: "var(--color-charcoal)" }}>
                          {item.active ? "Yes" : "No"}
                        </button>
                      </td>
                      <td className="px-4 py-3"><X size={13} style={{ color: "var(--color-sage-light)" }} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(74,87,89,0.4)" }}>
          <div className="rounded-2xl p-6 w-full max-w-xl shadow-xl overflow-y-auto max-h-[90vh]" style={{ backgroundColor: "white" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-medium" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>
                {editItem ? "Edit Budget Line" : "Add Budget Line"}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={20} style={{ color: "var(--color-subtle)" }} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <BField label="Category" value={formData.category ?? ""} onChange={v => setFormData(p => ({ ...p, category: v }))} />
              <div className="col-span-2"><BField label="Description" value={formData.description ?? ""} onChange={v => setFormData(p => ({ ...p, description: v }))} /></div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-subtle)" }}>Vendor</label>
                <select value={formData.vendor_id ?? ""} onChange={e => setFormData(p => ({ ...p, vendor_id: e.target.value || null }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={{ borderColor: "var(--color-sage-light)", color: "var(--color-charcoal)" }}>
                  <option value="">None</option>
                  {vendors.map(v => <option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}</option>)}
                </select>
              </div>
              <BField label="Units" value={String(formData.units ?? 1)} onChange={v => setFormData(p => ({ ...p, units: parseFloat(v) || 1 }))} type="number" />
              <BField label="Price per unit (€)" value={String(formData.price_per_unit_eur ?? 0)} onChange={v => setFormData(p => ({ ...p, price_per_unit_eur: parseFloat(v) || 0 }))} type="number" />
              <BField label="Actual invoiced (€)" value={String(formData.actual_invoiced_eur ?? 0)} onChange={v => setFormData(p => ({ ...p, actual_invoiced_eur: parseFloat(v) || 0 }))} type="number" />
              <BField label="Actual paid (€)" value={String(formData.actual_paid_eur ?? 0)} onChange={v => setFormData(p => ({ ...p, actual_paid_eur: parseFloat(v) || 0 }))} type="number" />
              <div className="col-span-2"><BField label="Notes" value={formData.notes ?? ""} onChange={v => setFormData(p => ({ ...p, notes: v || null }))} /></div>
              <label className="flex items-center gap-2 text-sm cursor-pointer col-span-2" style={{ color: "var(--color-charcoal)" }}>
                <input type="checkbox" checked={formData.active ?? true} onChange={e => setFormData(p => ({ ...p, active: e.target.checked }))} />
                Active
              </label>
            </div>
            {formData.price_per_unit_eur !== undefined && formData.units !== undefined && (
              <p className="text-sm mt-4 p-3 rounded-lg" style={{ backgroundColor: "var(--color-stone)", color: "var(--color-charcoal)" }}>
                Budget total: €{(formData.price_per_unit_eur * formData.units).toLocaleString()} · £{((formData.price_per_unit_eur * formData.units) * fxRate).toLocaleString("en-GB", { maximumFractionDigits: 0 })}
              </p>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-sm" style={{ color: "var(--color-subtle)" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60" style={{ backgroundColor: "var(--color-sage)", color: "var(--color-charcoal)" }}>
                {saving ? "Saving…" : editItem ? "Save changes" : "Add line"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BField({ label, value, onChange, type = "text" }: {
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
