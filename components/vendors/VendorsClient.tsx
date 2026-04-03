"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, X } from "lucide-react"
import type { Vendor, Invoice } from "@/types/database"

const CATEGORIES = ["Venue", "Catering", "Photography", "Videography", "Flowers", "Music/DJ", "Band", "Hair/Makeup", "Transport", "Stationery", "Officiant", "Decor/Rentals", "Cake", "Rings", "Attire", "Decoration", "Coordination", "Other"]

interface Props {
  initialVendors: Vendor[]
  initialInvoices: Invoice[]
  fxRate: number
}

export default function VendorsClient({ initialVendors, initialInvoices, fxRate }: Props) {
  const supabase = createClient()
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors)
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [tab, setTab] = useState<"vendors" | "invoices">("vendors")
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [editVendor, setEditVendor] = useState<Vendor | null>(null)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [vendorForm, setVendorForm] = useState<Partial<Vendor>>({})
  const [invoiceForm, setInvoiceForm] = useState<Partial<Invoice>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const ch = supabase.channel("vendors-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "vendors" }, p => {
        if (p.eventType === "INSERT") setVendors(prev => [...prev, p.new as Vendor])
        else if (p.eventType === "UPDATE") setVendors(prev => prev.map(v => v.id === (p.new as Vendor).id ? p.new as Vendor : v))
        else if (p.eventType === "DELETE") setVendors(prev => prev.filter(v => v.id !== (p.old as Vendor).id))
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, p => {
        if (p.eventType === "INSERT") setInvoices(prev => [...prev, p.new as Invoice])
        else if (p.eventType === "UPDATE") setInvoices(prev => prev.map(i => i.id === (p.new as Invoice).id ? p.new as Invoice : i))
        else if (p.eventType === "DELETE") setInvoices(prev => prev.filter(i => i.id !== (p.old as Invoice).id))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase])

  async function saveVendor() {
    setSaving(true)
    if (editVendor) {
      const { data } = await supabase.from("vendors").update(vendorForm).eq("id", editVendor.id).select().single()
      if (data) setVendors(p => p.map(v => v.id === editVendor.id ? data as Vendor : v))
    } else {
      const maxId = vendors.reduce((max, v) => Math.max(max, parseInt(v.vendor_id.replace("V", ""), 10) || 0), 0)
      const { data } = await supabase.from("vendors").insert({ ...vendorForm, vendor_id: `V${String(maxId + 1).padStart(3, "0")}` }).select().single()
      if (data) setVendors(p => [...p, data as Vendor])
    }
    setSaving(false); setShowVendorModal(false)
  }

  async function saveInvoice() {
    setSaving(true)
    if (editInvoice) {
      const { data } = await supabase.from("invoices").update(invoiceForm).eq("id", editInvoice.id).select().single()
      if (data) setInvoices(p => p.map(i => i.id === editInvoice.id ? data as Invoice : i))
    } else {
      const maxId = invoices.reduce((max, i) => Math.max(max, parseInt(i.invoice_id.replace("I", ""), 10) || 0), 0)
      const { data } = await supabase.from("invoices").insert({ ...invoiceForm, invoice_id: `I${String(maxId + 1).padStart(3, "0")}` }).select().single()
      if (data) setInvoices(p => [...p, data as Invoice])
    }
    setSaving(false); setShowInvoiceModal(false)
  }

  async function togglePaid(inv: Invoice) {
    const { data } = await supabase.from("invoices").update({ paid: !inv.paid }).eq("id", inv.id).select().single()
    if (data) setInvoices(p => p.map(i => i.id === inv.id ? data as Invoice : i))
  }

  const today = new Date().toISOString().split("T")[0]
  const totalOutstanding = invoices.filter(i => !i.paid).reduce((s, i) => s + i.amount_eur, 0)
  const totalPaid = invoices.filter(i => i.paid).reduce((s, i) => s + i.amount_eur, 0)

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <h1 className="text-5xl font-light" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>
          Vendors & Invoices
        </h1>
        <button
          onClick={() => tab === "vendors" ? (setEditVendor(null), setVendorForm({ contract_signed: false, contract_value_eur: 0 }), setShowVendorModal(true)) : (setEditInvoice(null), setInvoiceForm({ paid: false, amount_eur: 0 }), setShowInvoiceModal(true))}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ backgroundColor: "var(--color-sage)", color: "var(--color-charcoal)" }}>
          <Plus size={15} /> Add {tab === "vendors" ? "vendor" : "invoice"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ backgroundColor: "rgba(74,87,89,0.08)" }}>
        {(["vendors", "invoices"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-5 py-1.5 rounded-lg text-sm font-medium capitalize transition-all"
            style={{ backgroundColor: tab === t ? "var(--color-pink)" : "transparent", color: tab === t ? "var(--color-charcoal)" : "var(--color-subtle)" }}>
            {t} {t === "vendors" ? `(${vendors.length})` : `(${invoices.length})`}
          </button>
        ))}
      </div>

      {tab === "vendors" ? (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--color-blush)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-sage-light)" }}>
                {["Vendor", "Category", "Contact", "Email", "Phone", "Contract", "Value (€)"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>{h}</th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {vendors.map((v, idx) => (
                <tr key={v.id} onClick={() => { setEditVendor(v); setVendorForm({ ...v }); setShowVendorModal(true) }}
                  className="cursor-pointer" style={{ borderBottom: idx < vendors.length - 1 ? "1px solid var(--color-sage-light)" : "none" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-charcoal)" }}>{v.vendor_name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{v.category}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{v.contact_name ?? "–"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{v.email ?? "–"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{v.phone ?? "–"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: v.contract_signed ? "var(--color-sage)" : "var(--color-sage-light)", color: "var(--color-charcoal)" }}>
                      {v.contract_signed ? "Signed" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-charcoal)" }}>
                    {v.contract_value_eur > 0 ? `€${v.contract_value_eur.toLocaleString()}` : "–"}
                  </td>
                  <td className="px-4 py-3"><X size={13} style={{ color: "var(--color-sage-light)" }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Invoice summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total invoiced", value: invoices.reduce((s, i) => s + i.amount_eur, 0) },
              { label: "Total paid",     value: totalPaid },
              { label: "Outstanding",    value: totalOutstanding },
            ].map(card => (
              <div key={card.label} className="rounded-2xl p-4" style={{ backgroundColor: "var(--color-blush)" }}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--color-subtle)" }}>{card.label}</p>
                <p className="text-2xl font-light" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>
                  €{card.value.toLocaleString()} <span className="text-base">/ £{(card.value * fxRate).toLocaleString("en-GB", { maximumFractionDigits: 0 })}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--color-blush)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-sage-light)" }}>
                  {["ID", "Vendor", "Description", "Amount (€)", "Amount (£)", "Due date", "Paid by", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-subtle)" }}>{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, idx) => {
                  const vendor = vendors.find(v => v.id === inv.vendor_id)
                  const isOverdue = !inv.paid && inv.due_date && inv.due_date < today
                  return (
                    <tr key={inv.id} onClick={() => { setEditInvoice(inv); setInvoiceForm({ ...inv }); setShowInvoiceModal(true) }}
                      className="cursor-pointer" style={{ borderBottom: idx < invoices.length - 1 ? "1px solid var(--color-sage-light)" : "none" }}>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{inv.invoice_id}</td>
                      <td className="px-4 py-3" style={{ color: "var(--color-charcoal)" }}>{vendor?.vendor_name ?? "–"}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{inv.description}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--color-charcoal)" }}>€{inv.amount_eur.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>£{(inv.amount_eur * fxRate).toLocaleString("en-GB", { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: isOverdue ? "var(--color-warm-red)" : "var(--color-subtle)" }}>
                        {inv.due_date ?? "–"}{isOverdue ? " ⚠" : ""}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{inv.paid_by ?? "–"}</td>
                      <td className="px-4 py-3">
                        <button onClick={e => { e.stopPropagation(); togglePaid(inv) }}
                          className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: inv.paid ? "var(--color-sage)" : "var(--color-sage-light)", color: "var(--color-charcoal)" }}>
                          {inv.paid ? "Paid" : "Unpaid"}
                        </button>
                      </td>
                      <td className="px-4 py-3"><X size={13} style={{ color: "var(--color-sage-light)" }} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Vendor modal */}
      {showVendorModal && (
        <Modal title={editVendor ? "Edit Vendor" : "Add Vendor"} onClose={() => setShowVendorModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <VField label="Vendor name *" value={vendorForm.vendor_name ?? ""} onChange={v => setVendorForm(p => ({ ...p, vendor_name: v }))} />
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-subtle)" }}>Category</label>
              <select value={vendorForm.category ?? ""} onChange={e => setVendorForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={{ borderColor: "var(--color-sage-light)", color: "var(--color-charcoal)" }}>
                <option value="">Select…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <VField label="Contact name" value={vendorForm.contact_name ?? ""} onChange={v => setVendorForm(p => ({ ...p, contact_name: v || null }))} />
            <VField label="Email" value={vendorForm.email ?? ""} onChange={v => setVendorForm(p => ({ ...p, email: v || null }))} />
            <VField label="Website" value={vendorForm.website ?? ""} onChange={v => setVendorForm(p => ({ ...p, website: v || null }))} />
            <VField label="Phone" value={vendorForm.phone ?? ""} onChange={v => setVendorForm(p => ({ ...p, phone: v || null }))} />
            <VField label="Contract value (€)" value={String(vendorForm.contract_value_eur ?? 0)} onChange={v => setVendorForm(p => ({ ...p, contract_value_eur: parseFloat(v) || 0 }))} type="number" />
            <div className="col-span-2"><VField label="Address" value={vendorForm.address ?? ""} onChange={v => setVendorForm(p => ({ ...p, address: v || null }))} /></div>
            <div className="col-span-2"><VField label="Notes" value={vendorForm.notes ?? ""} onChange={v => setVendorForm(p => ({ ...p, notes: v || null }))} /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--color-charcoal)" }}>
              <input type="checkbox" checked={vendorForm.contract_signed ?? false} onChange={e => setVendorForm(p => ({ ...p, contract_signed: e.target.checked }))} />
              Contract signed
            </label>
          </div>
          <ModalFooter onCancel={() => setShowVendorModal(false)} onSave={saveVendor} saving={saving} isEdit={!!editVendor} />
        </Modal>
      )}

      {/* Invoice modal */}
      {showInvoiceModal && (
        <Modal title={editInvoice ? "Edit Invoice" : "Add Invoice"} onClose={() => setShowInvoiceModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-subtle)" }}>Vendor</label>
              <select value={invoiceForm.vendor_id ?? ""} onChange={e => setInvoiceForm(p => ({ ...p, vendor_id: e.target.value || null }))}
                className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={{ borderColor: "var(--color-sage-light)", color: "var(--color-charcoal)" }}>
                <option value="">None</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
              </select>
            </div>
            <VField label="Description *" value={invoiceForm.description ?? ""} onChange={v => setInvoiceForm(p => ({ ...p, description: v }))} />
            <VField label="Amount (€)" value={String(invoiceForm.amount_eur ?? 0)} onChange={v => setInvoiceForm(p => ({ ...p, amount_eur: parseFloat(v) || 0 }))} type="number" />
            <VField label="Due date" value={invoiceForm.due_date ?? ""} onChange={v => setInvoiceForm(p => ({ ...p, due_date: v || null }))} type="date" />
            <VField label="Invoice date" value={invoiceForm.invoice_date ?? ""} onChange={v => setInvoiceForm(p => ({ ...p, invoice_date: v || null }))} type="date" />
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-subtle)" }}>Paid by</label>
              <select value={invoiceForm.paid_by ?? ""} onChange={e => setInvoiceForm(p => ({ ...p, paid_by: e.target.value as Invoice["paid_by"] || null }))}
                className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={{ borderColor: "var(--color-sage-light)", color: "var(--color-charcoal)" }}>
                <option value="">–</option>
                <option value="Maggie">Maggie</option>
                <option value="Bobby">Bobby</option>
                <option value="Both">Both</option>
              </select>
            </div>
            <VField label="Payment method" value={invoiceForm.payment_method ?? ""} onChange={v => setInvoiceForm(p => ({ ...p, payment_method: v || null }))} />
            <VField label="Paid date" value={invoiceForm.paid_date ?? ""} onChange={v => setInvoiceForm(p => ({ ...p, paid_date: v || null }))} type="date" />
            <div className="col-span-2"><VField label="Notes" value={invoiceForm.notes ?? ""} onChange={v => setInvoiceForm(p => ({ ...p, notes: v || null }))} /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--color-charcoal)" }}>
              <input type="checkbox" checked={invoiceForm.paid ?? false} onChange={e => setInvoiceForm(p => ({ ...p, paid: e.target.checked }))} />
              Paid
            </label>
          </div>
          <ModalFooter onCancel={() => setShowInvoiceModal(false)} onSave={saveInvoice} saving={saving} isEdit={!!editInvoice} />
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(74,87,89,0.4)" }}>
      <div className="rounded-2xl p-6 w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "white" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-medium" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>{title}</h2>
          <button onClick={onClose}><X size={20} style={{ color: "var(--color-subtle)" }} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({ onCancel, onSave, saving, isEdit }: { onCancel: () => void; onSave: () => void; saving: boolean; isEdit: boolean }) {
  return (
    <div className="flex justify-end gap-3 mt-5">
      <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-sm" style={{ color: "var(--color-subtle)" }}>Cancel</button>
      <button onClick={onSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60" style={{ backgroundColor: "var(--color-sage)", color: "var(--color-charcoal)" }}>
        {saving ? "Saving…" : isEdit ? "Save changes" : "Add"}
      </button>
    </div>
  )
}

function VField({ label, value, onChange, type = "text" }: {
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
