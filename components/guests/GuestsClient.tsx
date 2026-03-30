"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, Search, X, Download, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"
import type { Guest } from "@/types/database"

const RSVP_COLORS: Record<string, string> = {
  Accepted: "var(--color-sage)",
  Declined: "var(--color-warm-red)",
  Pending:  "var(--color-sage-light)",
  Invited:  "var(--color-pink)",
}

const ALL_RSVP     = ["Accepted", "Declined", "Pending", "Invited"]
const ALL_SIDES    = ["Bride", "Groom"]
const ALL_DIETARY  = ["Vegetarian", "Vegan", "Pescatarian", "Gluten Free", "Other (see Allergies)"]

const EMPTY_GUEST: Partial<Guest> = {
  first_name: "", last_name: "", side: "Bride", rsvp_status: "Pending",
  save_the_date_sent: false, invite_sent: false, children_count: 0,
}

interface UnmatchedRsvp {
  name: string
  email: string | null
  attending: boolean
  dietary_requirements: string | null
  plus_one: boolean
  plus_one_name: string | null
  plus_one_dietary: string | null
  guest_count: number
  children: { name: string; dietary: string | null }[]
  created_at: string
}

interface Props {
  initialGuests: Guest[]
}

export default function GuestsClient({ initialGuests }: Props) {
  const supabase = createClient()
  const [guests, setGuests] = useState<Guest[]>(initialGuests)
  const [search, setSearch]           = useState("")
  const [filterRsvp, setFilterRsvp]   = useState("all")
  const [filterSide, setFilterSide]   = useState("all")
  const [activeTab, setActiveTab]     = useState("all")
  const [showModal, setShowModal]     = useState(false)
  const [editGuest, setEditGuest]     = useState<Guest | null>(null)
  const [formData, setFormData]       = useState<Partial<Guest>>(EMPTY_GUEST)
  const [sortField, setSortField]     = useState<keyof Guest>("guest_id")
  const [sortAsc, setSortAsc]         = useState(true)
  const [saving, setSaving]           = useState(false)

  // Sync
  type SyncStatus = "idle" | "syncing" | "done" | "error"
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle")
  const [syncResult, setSyncResult] = useState<{ synced: number; added: number; unmatched: UnmatchedRsvp[] } | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Manual match
  const [matchTarget, setMatchTarget] = useState<UnmatchedRsvp | null>(null)
  const [matchGuestIds, setMatchGuestIds] = useState<string[]>([])
  const [matchSearch, setMatchSearch] = useState("")
  const [matching, setMatching] = useState(false)

  const runSync = async () => {
    setSyncStatus("syncing")
    setSyncResult(null)
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    try {
      const res = await fetch("/api/sync-rsvps", { method: "POST" })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSyncResult(data)
      setSyncStatus("done")
      if (data.unmatched.length === 0) {
        dismissTimer.current = setTimeout(() => setSyncStatus("idle"), 10_000)
      }
    } catch {
      setSyncStatus("error")
    }
  }

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("guests-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, payload => {
        if (payload.eventType === "INSERT") setGuests(p => [...p, payload.new as Guest])
        else if (payload.eventType === "UPDATE") setGuests(p => p.map(g => g.id === (payload.new as Guest).id ? payload.new as Guest : g))
        else if (payload.eventType === "DELETE") setGuests(p => p.filter(g => g.id !== (payload.old as Guest).id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  // Auto-sync on mount
  useEffect(() => {
    runSync()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let list = [...guests]
    if (activeTab === "bride") list = list.filter(g => g.side === "Bride")
    else if (activeTab === "groom") list = list.filter(g => g.side === "Groom")
    else if (activeTab === "dietary") list = list.filter(g => g.dietary_requirement || g.allergies_notes || g.children_dietary)
    if (filterRsvp !== "all") list = list.filter(g => g.rsvp_status === filterRsvp)
    if (filterSide !== "all") list = list.filter(g => g.side === filterSide)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(g =>
        g.first_name.toLowerCase().includes(q) ||
        (g.last_name ?? "").toLowerCase().includes(q) ||
        (g.email ?? "").toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      const av = String(a[sortField] ?? "")
      const bv = String(b[sortField] ?? "")
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return list
  }, [guests, activeTab, filterRsvp, filterSide, search, sortField, sortAsc])

  function openAdd() {
    setEditGuest(null)
    setFormData(EMPTY_GUEST)
    setShowModal(true)
  }
  function openEdit(g: Guest) {
    setEditGuest(g)
    setFormData({ ...g })
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    if (editGuest) {
      const { data } = await supabase.from("guests").update(formData).eq("id", editGuest.id).select().single()
      if (data) setGuests(p => p.map(g => g.id === editGuest.id ? data as Guest : g))
    } else {
      const maxId = guests.reduce((max, g) => {
        const n = parseInt(g.guest_id.replace("G", ""), 10)
        return isNaN(n) ? max : Math.max(max, n)
      }, 0)
      const guest_id = `G${String(maxId + 1).padStart(3, "0")}`
      const { data } = await supabase.from("guests").insert({ ...formData, guest_id }).select().single()
      if (data) setGuests(p => [...p, data as Guest])
    }
    setSaving(false)
    setShowModal(false)
  }

  async function handleDelete(g: Guest) {
    if (!confirm(`Remove ${g.first_name} ${g.last_name ?? ""}?`)) return
    await supabase.from("guests").delete().eq("id", g.id)
    setGuests(p => p.filter(x => x.id !== g.id))
  }

  async function handleMatch() {
    if (!matchTarget || matchGuestIds.length === 0) return
    setMatching(true)
    const res = await fetch("/api/sync-rsvps/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestIds: matchGuestIds, rsvp: matchTarget }),
    })
    if (res.ok) {
      setSyncResult(prev => prev ? {
        ...prev,
        unmatched: prev.unmatched.filter(u => u !== matchTarget),
        synced: prev.synced + matchGuestIds.length,
      } : prev)
      // Guest updates come via realtime channel automatically
    }
    setMatching(false)
    setMatchTarget(null)
    setMatchGuestIds([])
    setMatchSearch("")
  }

  function exportCsv() {
    const header = "Guest ID,First Name,Last Name,Side,Email,RSVP Status,Dietary,Allergies,Children,Children Dietary,Children Allergies,Save The Date,Invite Sent\n"
    const rows = filtered.map(g =>
      [g.guest_id, g.first_name, g.last_name ?? "", g.side, g.email ?? "",
       g.rsvp_status, g.dietary_requirement ?? "", g.allergies_notes ?? "",
       g.children_count, g.children_dietary ?? "", g.children_allergies ?? "",
       g.save_the_date_sent ? "Yes" : "No", g.invite_sent ? "Yes" : "No"]
       .map(v => `"${v}"`).join(",")
    ).join("\n")
    const blob = new Blob([header + rows], { type: "text/csv" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "guests.csv"; a.click()
  }

  function setSort(field: keyof Guest) {
    if (sortField === field) setSortAsc(a => !a)
    else { setSortField(field); setSortAsc(true) }
  }

  const summary = {
    total: guests.length,
    accepted: guests.filter(g => g.rsvp_status === "Accepted").length,
    declined: guests.filter(g => g.rsvp_status === "Declined").length,
    pending:  guests.filter(g => g.rsvp_status === "Pending" || g.rsvp_status === "Invited").length,
  }

  const tabs = [
    { key: "all",     label: `All (${guests.length})` },
    { key: "bride",   label: `Bride's side (${guests.filter(g => g.side === "Bride").length})` },
    { key: "groom",   label: `Groom's side (${guests.filter(g => g.side === "Groom").length})` },
    { key: "dietary", label: "Dietary needs" },
  ]

  const matchFilteredGuests = useMemo(() => {
    if (!matchSearch) return guests
    const q = matchSearch.toLowerCase()
    return guests.filter(g =>
      g.first_name.toLowerCase().includes(q) ||
      (g.last_name ?? "").toLowerCase().includes(q) ||
      (g.email ?? "").toLowerCase().includes(q)
    )
  }, [guests, matchSearch])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-5xl font-light mb-1" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>
            Guests
          </h1>
          <div className="flex gap-4 text-sm mt-1">
            <span style={{ color: "var(--color-charcoal)" }}>{summary.total} total</span>
            <span style={{ color: "var(--color-sage)" }}>✓ {summary.accepted} accepted</span>
            <span style={{ color: "var(--color-warm-red)" }}>✗ {summary.declined} declined</span>
            <span style={{ color: "var(--color-subtle)" }}>… {summary.pending} pending</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border" style={{ borderColor: "var(--color-sage-light)", color: "var(--color-subtle)" }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--color-sage)", color: "var(--color-charcoal)" }}>
            <Plus size={15} /> Add guest
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ backgroundColor: "rgba(74,87,89,0.08)" }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{ backgroundColor: activeTab === tab.key ? "var(--color-pink)" : "transparent", color: activeTab === tab.key ? "var(--color-charcoal)" : "var(--color-subtle)" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-subtle)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guests…"
            className="pl-8 pr-3 py-2 rounded-lg text-sm border" style={{ backgroundColor: "var(--color-blush)", borderColor: "var(--color-sage-light)", color: "var(--color-charcoal)", width: "200px" }} />
        </div>
        <GuestSelect label="RSVP" value={filterRsvp} onChange={setFilterRsvp} options={ALL_RSVP} />
        {(filterRsvp !== "all" || search) && (
          <button onClick={() => { setFilterRsvp("all"); setSearch("") }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs" style={{ color: "var(--color-warm-red)", backgroundColor: "rgba(192,115,106,0.1)" }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Sync banner */}
      {syncStatus !== "idle" && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{
            backgroundColor:
              syncStatus === "error" ? "rgba(192,115,106,0.15)" :
              syncStatus === "syncing" ? "rgba(74,87,89,0.08)" :
              syncResult && syncResult.unmatched.length > 0 ? "rgba(255,193,7,0.15)" :
              "rgba(100,140,100,0.12)",
            color: "var(--color-charcoal)",
          }}>
          <div className="flex items-center justify-between gap-4">
            <span>
              {syncStatus === "syncing" && (
                <span className="flex items-center gap-2">
                  <RefreshCw size={13} className="animate-spin" style={{ color: "var(--color-subtle)" }} />
                  Syncing RSVPs from website…
                </span>
              )}
              {syncStatus === "done" && syncResult && syncResult.unmatched.length === 0 && (
                <span style={{ color: "var(--color-sage)" }}>
                  ✓ {syncResult.synced} RSVP{syncResult.synced !== 1 ? "s" : ""} synced
                  {syncResult.added > 0 && ` · ${syncResult.added} guest${syncResult.added !== 1 ? "s" : ""} added`}
                </span>
              )}
              {syncStatus === "done" && syncResult && syncResult.unmatched.length > 0 && (
                <span>
                  <span style={{ color: "var(--color-sage)" }}>
                    ✓ {syncResult.synced} synced{syncResult.added > 0 ? ` · ${syncResult.added} added` : ""}
                  </span>
                  {" · "}
                  <span style={{ color: "#b45309" }}>
                    ⚠ {syncResult.unmatched.length} unmatched
                  </span>
                </span>
              )}
              {syncStatus === "error" && (
                <span style={{ color: "var(--color-warm-red)" }}>
                  ✗ Sync failed — check RSVP_API_KEY in .env.local
                </span>
              )}
            </span>
            {syncStatus !== "syncing" && (
              <button onClick={runSync} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs border"
                style={{ borderColor: "var(--color-sage-light)", color: "var(--color-subtle)", whiteSpace: "nowrap" }}>
                <RefreshCw size={11} /> Sync again
              </button>
            )}
          </div>

          {/* Unmatched cards */}
          {syncStatus === "done" && syncResult && syncResult.unmatched.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {syncResult.unmatched.map((u, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                  style={{ backgroundColor: "rgba(180,83,9,0.08)" }}>
                  <span>
                    <strong>{u.name}</strong>
                    {u.email && <span style={{ color: "var(--color-subtle)" }}> · {u.email}</span>}
                    {" · "}
                    <span style={{ color: u.attending ? "var(--color-sage)" : "var(--color-warm-red)" }}>
                      {u.attending ? "Attending" : "Declined"}
                    </span>
                    {u.dietary_requirements && <span> · {u.dietary_requirements}</span>}
                  </span>
                  <button onClick={() => { setMatchTarget(u); setMatchGuestIds([]); setMatchSearch("") }}
                    className="ml-3 px-2 py-1 rounded text-xs border"
                    style={{ borderColor: "#b45309", color: "#b45309" }}>
                    Match
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--color-blush)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-sage-light)" }}>
                {[
                  { key: "first_name", label: "Name" },
                  { key: "side", label: "Side" },
                  { key: "rsvp_status", label: "RSVP" },
                  { key: "save_the_date_sent", label: "STD" },
                  { key: "invite_sent", label: "Invite" },
                  { key: "dietary_requirement", label: "Dietary" },
                  { key: "children_count", label: "Children" },
                  { key: "email", label: "Email" },
                ].map(col => (
                  <th key={col.key} onClick={() => setSort(col.key as keyof Guest)}
                    className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider cursor-pointer select-none"
                    style={{ color: "var(--color-subtle)" }}>
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortField === col.key ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : null}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((g, idx) => (
                <tr key={g.id}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: idx < filtered.length - 1 ? "1px solid var(--color-sage-light)" : "none" }}
                  onClick={() => openEdit(g)}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-charcoal)" }}>
                    {g.first_name} {g.last_name ?? ""}
                    {g.head_guest_id && <span className="text-xs ml-1" style={{ color: "var(--color-subtle)" }}>↳</span>}
                    {g.rsvp_synced && (
                      <span title="RSVP synced" className="ml-1.5 text-xs" style={{ color: "var(--color-sage)" }}>●</span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-subtle)" }}>{g.side}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: RSVP_COLORS[g.rsvp_status] ?? "var(--color-sage-light)", color: "var(--color-charcoal)" }}>
                      {g.rsvp_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: g.save_the_date_sent ? "#2d6a4f" : "transparent" }}>
                    ✓
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: g.invite_sent ? "#2d6a4f" : "transparent" }}>
                    ✓
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{g.dietary_requirement || "–"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>
                    {g.children_count > 0 ? g.children_count : "–"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--color-subtle)" }}>{g.email || "–"}</td>
                  <td className="px-4 py-3" onClick={e => { e.stopPropagation(); handleDelete(g) }}>
                    <X size={13} style={{ color: "var(--color-sage-light)" }} className="hover:text-warm-red" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-sm text-center" style={{ color: "var(--color-subtle)" }}>No guests match.</p>
          )}
        </div>
      </div>

      {/* Edit/Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(74,87,89,0.4)" }}>
          <div className="rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl" style={{ backgroundColor: "white" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-medium" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>
                {editGuest ? "Edit Guest" : "Add Guest"}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={20} style={{ color: "var(--color-subtle)" }} /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <GField label="First name *" value={formData.first_name ?? ""} onChange={v => setFormData(p => ({ ...p, first_name: v }))} />
              <GField label="Last name" value={formData.last_name ?? ""} onChange={v => setFormData(p => ({ ...p, last_name: v || null }))} />
              <GField label="Email" value={formData.email ?? ""} onChange={v => setFormData(p => ({ ...p, email: v || null }))} />
              <GField label="Phone" value={formData.phone ?? ""} onChange={v => setFormData(p => ({ ...p, phone: v || null }))} />
              <GSelect label="Side" value={formData.side ?? "Bride"} onChange={v => setFormData(p => ({ ...p, side: v as "Bride"|"Groom" }))} options={ALL_SIDES} />
              <GSelect label="RSVP status" value={formData.rsvp_status ?? "Pending"} onChange={v => setFormData(p => ({ ...p, rsvp_status: v as Guest["rsvp_status"] }))} options={ALL_RSVP} />
              <GField label="RSVP date" value={formData.rsvp_date ?? ""} onChange={v => setFormData(p => ({ ...p, rsvp_date: v || null }))} type="date" />
              <GField label="Dietary requirement" value={formData.dietary_requirement ?? ""} onChange={v => setFormData(p => ({ ...p, dietary_requirement: v || null }))} placeholder="e.g. Vegetarian, Gluten Free, No seafood…" />
              <div className="col-span-2">
                <GField label="Allergies / notes" value={formData.allergies_notes ?? ""} onChange={v => setFormData(p => ({ ...p, allergies_notes: v || null }))} />
              </div>

              {/* Checkboxes */}
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--color-charcoal)" }}>
                <input type="checkbox" checked={formData.save_the_date_sent ?? false} onChange={e => setFormData(p => ({ ...p, save_the_date_sent: e.target.checked }))} className="rounded" />
                Save the date sent
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--color-charcoal)" }}>
                <input type="checkbox" checked={formData.invite_sent ?? false} onChange={e => setFormData(p => ({ ...p, invite_sent: e.target.checked }))} className="rounded" />
                Invite sent
              </label>

              {/* Children section */}
              <div className="col-span-2 pt-2 border-t" style={{ borderColor: "var(--color-sage-light)" }}>
                <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--color-subtle)" }}>Children</p>
                <div className="grid grid-cols-3 gap-4">
                  <GField label="Children attending" value={String(formData.children_count ?? 0)} onChange={v => setFormData(p => ({ ...p, children_count: parseInt(v) || 0 }))} type="number" />
                  <GField label="Children dietary" value={formData.children_dietary ?? ""} onChange={v => setFormData(p => ({ ...p, children_dietary: v || null }))} />
                  <GField label="Children allergies" value={formData.children_allergies ?? ""} onChange={v => setFormData(p => ({ ...p, children_allergies: v || null }))} />
                </div>
              </div>

              <div className="col-span-2">
                <GField label="Follow-up notes" value={formData.follow_up_notes ?? ""} onChange={v => setFormData(p => ({ ...p, follow_up_notes: v || null }))} />
              </div>
              <div className="col-span-2">
                <GField label="Head guest ID (for couples/families)" value={formData.head_guest_id ?? ""} onChange={v => setFormData(p => ({ ...p, head_guest_id: v || null }))} placeholder="e.g. G001" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-sm" style={{ color: "var(--color-subtle)" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60" style={{ backgroundColor: "var(--color-sage)", color: "var(--color-charcoal)" }}>
                {saving ? "Saving…" : editGuest ? "Save changes" : "Add guest"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Match Modal */}
      {matchTarget && (() => {
        // Pre-compute names from the RSVP for the preview panel
        const primaryParts = matchTarget.name.trim().split(" ")
        const primaryFirst = primaryParts[0]
        const primaryLast  = primaryParts.slice(1).join(" ") || null
        const plusParts = matchTarget.plus_one_name ? matchTarget.plus_one_name.trim().split(" ") : []
        const plusFirst = plusParts[0] ?? null
        const plusLast  = plusParts.slice(1).join(" ") || null

        // For each selected guest, compute what name will be written
        const nameMap = matchGuestIds.map((gid, i) => {
          const g = guests.find(x => x.id === gid)
          if (!g) return null
          const newFirst = i === 0 ? primaryFirst : (i === 1 && plusFirst ? plusFirst : primaryFirst)
          const newLast  = i === 0 ? primaryLast  : (i === 1 && plusFirst ? plusLast  : primaryLast)
          const currentName = `${g.first_name}${g.last_name ? " " + g.last_name : ""}`
          const newName     = `${newFirst}${newLast ? " " + newLast : ""}`
          return { currentName, newName, same: currentName === newName }
        }).filter(Boolean) as { currentName: string; newName: string; same: boolean }[]

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(74,87,89,0.4)" }}>
            <div className="rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" style={{ backgroundColor: "white" }}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: "#2d6a4f" }}>
                <h2 className="text-base font-semibold" style={{ color: "white" }}>
                  🔗 Match RSVP to Guest Records
                </h2>
                <button onClick={() => { setMatchTarget(null); setMatchGuestIds([]); setMatchSearch("") }}>
                  <X size={18} style={{ color: "rgba(255,255,255,0.7)" }} />
                </button>
              </div>

              <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">

                {/* RSVP source card */}
                <div className="rounded-xl p-4" style={{ backgroundColor: "#f0f7f4", border: "1.5px solid #b7deca" }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#2d6a4f" }}>From RSVP website</p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-lg font-bold" style={{ color: "#1a1a1a" }}>{matchTarget.name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "#2d6a4f", color: "white" }}>
                      {matchTarget.attending ? "Attending ✓" : "Declined ✗"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs" style={{ color: "#666" }}>
                    {matchTarget.email && <span>📧 {matchTarget.email}</span>}
                    {matchTarget.dietary_requirements && <span>🍽 {matchTarget.dietary_requirements}</span>}
                    {matchTarget.children && matchTarget.children.length > 0 && (
                      <span>👶 {matchTarget.children.length} child{matchTarget.children.length !== 1 ? "ren" : ""}</span>
                    )}
                  </div>
                  {matchTarget.plus_one && matchTarget.plus_one_name && (
                    <div className="flex items-baseline gap-2 mt-2 pt-2" style={{ borderTop: "1px dashed #b7deca" }}>
                      <span className="text-xs font-bold uppercase" style={{ color: "#999" }}>+1</span>
                      <span className="text-sm font-semibold" style={{ color: "#333" }}>{matchTarget.plus_one_name}</span>
                      {matchTarget.plus_one_dietary && (
                        <span className="text-xs" style={{ color: "#888" }}>🍽 {matchTarget.plus_one_dietary}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Guest search + list */}
                <div>
                  <p className="text-xs mb-2" style={{ color: "var(--color-subtle)" }}>
                    Select the guest record(s) this RSVP belongs to — 1st selected gets primary name &amp; dietary, 2nd gets +1 name &amp; dietary
                  </p>
                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-subtle)" }} />
                    <input
                      value={matchSearch}
                      onChange={e => setMatchSearch(e.target.value)}
                      placeholder="Search by name or email…"
                      className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border"
                      style={{ borderColor: "var(--color-sage-light)", color: "var(--color-charcoal)" }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
                    {matchFilteredGuests.map(g => {
                      const selIdx = matchGuestIds.indexOf(g.id)
                      const isSelected = selIdx !== -1
                      const tagLabel = selIdx === 0 ? "Primary" : selIdx === 1 ? "+1" : `#${selIdx + 1}`
                      const tagColor = selIdx === 0 ? "#2d6a4f" : "#6b9e8a"

                      // Compute what name will be written for this guest
                      const newFirst = selIdx === 0 ? primaryFirst : (selIdx === 1 && plusFirst ? plusFirst : primaryFirst)
                      const newLast  = selIdx === 0 ? primaryLast  : (selIdx === 1 && plusFirst ? plusLast  : primaryLast)
                      const newName  = `${newFirst}${newLast ? " " + newLast : ""}`
                      const currentName = `${g.first_name}${g.last_name ? " " + g.last_name : ""}`
                      const nameWillChange = isSelected && currentName !== newName

                      return (
                        <button
                          key={g.id}
                          onClick={() => setMatchGuestIds(prev =>
                            prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev, g.id]
                          )}
                          className="text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-3"
                          style={{
                            border: isSelected ? `1.5px solid ${tagColor}` : "1.5px solid #e0e0e0",
                            backgroundColor: isSelected ? (selIdx === 0 ? "#f0f7f4" : "#f5fbf8") : "white",
                            color: "var(--color-charcoal)",
                          }}
                        >
                          {/* Checkbox */}
                          <div className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
                            style={{
                              border: `2px solid ${isSelected ? tagColor : "#ccc"}`,
                              backgroundColor: isSelected ? tagColor : "white",
                              color: "white",
                            }}>
                            {isSelected ? "✓" : ""}
                          </div>
                          {/* Name + meta */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm">
                              {g.first_name} {g.last_name ?? ""}
                              {nameWillChange && (
                                <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fef3c7", border: "1px solid #fbbf24", color: "#b45309" }}>
                                  → {newName}
                                </span>
                              )}
                              {isSelected && !nameWillChange && (
                                <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#d1fae5", border: "1px solid #6ee7b7", color: "#065f46" }}>
                                  name unchanged ✓
                                </span>
                              )}
                            </div>
                            <div className="text-xs" style={{ color: "var(--color-subtle)" }}>
                              {g.guest_id}{g.email ? ` · ${g.email}` : ""}
                            </div>
                          </div>
                          {/* Selection tag */}
                          {isSelected && (
                            <span className="text-xs font-bold uppercase px-2 py-0.5 rounded flex-shrink-0"
                              style={{ backgroundColor: tagColor, color: "white", letterSpacing: "0.05em" }}>
                              {tagLabel}
                            </span>
                          )}
                        </button>
                      )
                    })}
                    {matchFilteredGuests.length === 0 && (
                      <p className="text-xs py-3 text-center" style={{ color: "var(--color-subtle)" }}>No guests match.</p>
                    )}
                  </div>
                </div>

                {/* Name mapping preview */}
                {matchGuestIds.length > 0 && nameMap.length > 0 ? (
                  <div className="rounded-xl p-4" style={{ backgroundColor: "#fffbeb", border: "1.5px solid #f59e0b" }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#b45309" }}>
                      ⟶ Name update preview
                    </p>
                    <div className="grid text-xs font-bold uppercase tracking-wider mb-1" style={{ gridTemplateColumns: "1fr 20px 1fr", color: "#aaa" }}>
                      <span>Current name in database</span>
                      <span></span>
                      <span>Will be updated to</span>
                    </div>
                    {nameMap.map((row, i) => (
                      <div key={i} className="grid items-center gap-1 mb-1.5" style={{ gridTemplateColumns: "1fr 20px 1fr" }}>
                        <div className="px-3 py-2 rounded text-sm" style={{ backgroundColor: "#fef3c7", border: "1px solid #fbbf24", color: "#78350f" }}>
                          {row.currentName}
                        </div>
                        <div className="text-center font-bold" style={{ color: "#b45309" }}>→</div>
                        <div className="px-3 py-2 rounded text-sm font-bold" style={{ backgroundColor: "#f0f7f4", border: "1px solid #6ee7b7", color: "#064e3b" }}>
                          {row.newName}
                          {row.same && <span className="ml-1 font-normal text-xs" style={{ color: "#065f46" }}>(no change)</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl p-4 text-center text-sm" style={{ backgroundColor: "#fafafa", border: "1.5px solid #e0e0e0", color: "#aaa" }}>
                    Select at least one guest above to preview which names will be updated
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--color-sage-light)" }}>
                <button
                  onClick={() => { setMatchTarget(null); setMatchGuestIds([]); setMatchSearch("") }}
                  className="px-5 py-2.5 rounded-xl text-sm"
                  style={{ color: "var(--color-subtle)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleMatch}
                  disabled={matchGuestIds.length === 0 || matching}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
                  style={{ backgroundColor: "#2d6a4f", color: "white" }}
                >
                  {matching ? "Applying…" : matchGuestIds.length > 1 ? `✓ Apply RSVP to ${matchGuestIds.length} guests` : "✓ Apply RSVP"}
                </button>
              </div>

            </div>
          </div>
        )
      })()}
    </div>
  )
}

function GField({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-subtle)" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--color-sage-light)", color: "var(--color-charcoal)" }} />
    </div>
  )
}

function GSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-subtle)" }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={{ borderColor: "var(--color-sage-light)", color: "var(--color-charcoal)" }}>
        {options.map(o => <option key={o} value={o}>{o || "None"}</option>)}
      </select>
    </div>
  )
}

function GuestSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="px-3 py-2 rounded-lg text-sm border appearance-none"
      style={{ backgroundColor: "var(--color-blush)", borderColor: "var(--color-sage-light)", color: value === "all" ? "var(--color-subtle)" : "var(--color-charcoal)" }}>
      <option value="all">All {label}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
