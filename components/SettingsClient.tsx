"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Save, ExternalLink } from "lucide-react"
import type { AppSetting } from "@/types/database"

interface Props {
  initialSettings: AppSetting[]
}

const LABELS: Record<string, string> = {
  wedding_date:       "Wedding Date",
  fx_rate_eur_gbp:    "FX Rate (EUR → GBP)",
  default_seats:      "Default Seats per Table",
  seating_plan_url:   "Seating Plan URL",
  maggie_email:       "Maggie's Email",
  bobby_email:        "Bobby's Email",
}

const DESCRIPTIONS: Record<string, string> = {
  wedding_date:     "The big day — used for the countdown.",
  fx_rate_eur_gbp:  "Used throughout the budget to convert EUR → GBP. Update when rates change.",
  default_seats:    "Default number of seats per table for seating calculations.",
  seating_plan_url: "Opens in a new tab when you click Seating Plan in the sidebar.",
  maggie_email:     "Used to identify which user is Maggie for 'My Tasks' filtering.",
  bobby_email:      "Used to identify which user is Bobby for 'My Tasks' filtering.",
}

export default function SettingsClient({ initialSettings }: Props) {
  const supabase = createClient()
  const [settings, setSettings] = useState<Record<string, string>>(
    Object.fromEntries(initialSettings.map(s => [s.key, s.value]))
  )
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)

  async function handleSave(key: string) {
    setSaving(key)
    await supabase
      .from("settings")
      .upsert({ key, value: settings[key], label: LABELS[key] ?? key }, { onConflict: "key" })
    setSaving(null)
    setSaved(p => ({ ...p, [key]: true }))
    setTimeout(() => setSaved(p => ({ ...p, [key]: false })), 2000)
  }

  const keys = Object.keys(LABELS)

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-5xl font-light mb-1" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>
          Settings
        </h1>
        <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
          App-wide configuration. Changes take effect immediately.
        </p>
      </div>

      <div className="space-y-4">
        {keys.map(key => {
          const value = settings[key] ?? ""
          const isDate = key === "wedding_date"
          const isUrl  = key === "seating_plan_url"
          const isNum  = key === "fx_rate_eur_gbp" || key === "default_seats"

          return (
            <div key={key} className="rounded-2xl p-5" style={{ backgroundColor: "var(--color-blush)" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-0.5" style={{ color: "var(--color-charcoal)" }}>
                    {LABELS[key]}
                  </label>
                  <p className="text-xs mb-3" style={{ color: "var(--color-subtle)" }}>
                    {DESCRIPTIONS[key]}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type={isDate ? "date" : isNum ? "number" : "text"}
                      step={key === "fx_rate_eur_gbp" ? "0.01" : undefined}
                      value={value}
                      onChange={e => setSettings(p => ({ ...p, [key]: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg text-sm border"
                      style={{
                        borderColor: "var(--color-sage-light)",
                        color: "var(--color-charcoal)",
                        backgroundColor: "white",
                        maxWidth: "320px",
                      }}
                    />
                    {isUrl && value && (
                      <a href={value} target="_blank" rel="noopener noreferrer"
                        className="p-2 rounded-lg" style={{ color: "var(--color-subtle)" }}>
                        <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleSave(key)}
                  disabled={saving === key}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium mt-8 shrink-0 disabled:opacity-60 transition-colors"
                  style={{
                    backgroundColor: saved[key] ? "var(--color-sage)" : "var(--color-stone)",
                    color: "var(--color-charcoal)",
                  }}
                >
                  <Save size={13} />
                  {saving === key ? "Saving…" : saved[key] ? "Saved!" : "Save"}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Info card */}
      <div className="rounded-2xl p-5 mt-8" style={{ backgroundColor: "var(--color-stone)", border: "1px solid var(--color-sage-light)" }}>
        <h2 className="text-lg font-medium mb-2" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}>
          User accounts
        </h2>
        <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
          To add or change user accounts (Maggie &amp; Bobby), go to your{" "}
          <strong>Supabase dashboard → Authentication → Users</strong>.
          Passwords can be reset there too.
        </p>
      </div>
    </div>
  )
}
